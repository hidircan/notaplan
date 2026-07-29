/**
 * Workflow Engine — schedules & runs registered autonomous workflows.
 * Business actions only via Agent Runtime (executeAgentTool).
 */

import { DEFAULT_TENANT_ID } from "../auth/config";
import { recordAiExecution } from "../ai/metrics";
import { getProviderConfig } from "../ai/config";
import { runWithTenantAsync } from "../tenant-context";
import { WORKFLOW_REGISTRY, listWorkflowDefinitions } from "./registry";
import {
  getWorkflowState,
  isDue,
  listWorkflowRuns,
  listWorkflowStates,
  recordWorkflowRun,
  setWorkflowEnabled,
} from "./state";
import { workflowAgentContext } from "./runtime";
import type { WorkflowId, WorkflowRunResult } from "./types";

export async function runWorkflow(
  workflowId: WorkflowId,
  tenantId = DEFAULT_TENANT_ID
): Promise<WorkflowRunResult> {
  const def = WORKFLOW_REGISTRY[workflowId];
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  if (!def) {
    const fail: WorkflowRunResult = {
      workflowId,
      tenantId,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      success: false,
      steps: [],
      error: `Unknown workflow: ${workflowId}`,
    };
    await recordWorkflowRun(fail);
    return fail;
  }

  const ctx = workflowAgentContext(tenantId);

  try {
    const steps = await runWithTenantAsync(tenantId, () => def.run(ctx));
    const success = steps.length > 0 && steps.every((s) => s.ok);
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - t0;

    const result: WorkflowRunResult = {
      workflowId,
      tenantId,
      startedAt,
      finishedAt,
      durationMs,
      success,
      steps,
      error: steps.some((s) => !s.ok)
        ? steps
            .filter((s) => !s.ok)
            .map((s) => s.error)
            .join("; ")
        : undefined,
    };

    await recordWorkflowRun(result);

    const cfg = getProviderConfig();
    void recordAiExecution({
      tenantId,
      userId: ctx.userId,
      provider: `workflow:${workflowId}`,
      model: cfg.model,
      toolName: workflowId,
      phase: "turn",
      durationMs,
      success: result.success,
      error: result.error,
      billableUnits: Math.max(1, steps.length),
      conversationId: `workflow:${workflowId}`,
    });

    // Workflow long-term memory (outcomes only — no tool bypass)
    const { recordWorkflowMemory } = await import("../ai/memory");
    void recordWorkflowMemory({
      tenantId,
      workflowId,
      success: result.success,
      summary: `${workflowId}: ${steps.length} steps, success=${result.success}${
        result.error ? ` error=${result.error}` : ""
      }`,
      metadata: {
        durationMs,
        stepTools: steps.map((s) => s.tool),
      },
    });

    return result;
  } catch (e) {
    const finishedAt = new Date().toISOString();
    const result: WorkflowRunResult = {
      workflowId,
      tenantId,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
      success: false,
      steps: [],
      error: e instanceof Error ? e.message : "workflow failed",
    };
    await recordWorkflowRun(result);
    void recordAiExecution({
      tenantId,
      userId: ctx.userId,
      provider: `workflow:${workflowId}`,
      model: getProviderConfig().model,
      toolName: workflowId,
      phase: "turn",
      durationMs: result.durationMs,
      success: false,
      error: result.error,
      billableUnits: 1,
    });
    return result;
  }
}

/** Run all enabled workflows that are due (for external cron / tick). */
export async function tickWorkflows(tenantId = DEFAULT_TENANT_ID): Promise<{
  ran: WorkflowId[];
  results: WorkflowRunResult[];
}> {
  const ran: WorkflowId[] = [];
  const results: WorkflowRunResult[] = [];

  for (const def of listWorkflowDefinitions()) {
    if (await isDue(def.id)) {
      ran.push(def.id);
      results.push(await runWorkflow(def.id, tenantId));
    }
  }

  return { ran, results };
}

export async function listWorkflowsForAdmin() {
  const defs = listWorkflowDefinitions();
  const states = await listWorkflowStates();
  const stateMap = Object.fromEntries(states.map((s) => [s.id, s]));
  return defs.map((d) => ({
    ...d,
    state: stateMap[d.id] || {
      id: d.id,
      enabled: d.defaultEnabled,
      runCount: 0,
    },
  }));
}

export {
  setWorkflowEnabled,
  listWorkflowRuns,
  getWorkflowState,
};

export { listWorkflowDefinitions } from "./registry";
