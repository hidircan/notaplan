/** Helper: run a single Agent Runtime tool and map to WorkflowStepResult */
import { executeAgentTool } from "../agent";
import type { ServiceContext } from "../services/context";
import type { AgentToolName } from "../agent/types";
import type { WorkflowStepResult } from "./types";

export async function runWorkflowTool(
  ctx: ServiceContext,
  tool: AgentToolName,
  input: unknown,
  conversationId?: string
): Promise<WorkflowStepResult> {
  const exec = await executeAgentTool(
    { ...ctx, channel: "mcp", requestId: `wf_${crypto.randomUUID().slice(0, 8)}` },
    {
      tool,
      input,
      conversationId,
      channel: "mcp",
    }
  );

  if (exec.ok) {
    return {
      tool,
      ok: true,
      summary: `OK ${tool}`,
      data: exec.data.result,
    };
  }
  return {
    tool,
    ok: false,
    summary: `FAIL ${tool}: ${exec.error.message}`,
    error: exec.error.message,
  };
}

/** System/agent context for autonomous workflows */
export function workflowAgentContext(tenantId: string): ServiceContext {
  return {
    role: "AI_AGENT",
    userId: "workflow_engine",
    tenantId,
    channel: "mcp",
    requestId: `wf_engine_${Date.now().toString(36)}`,
  };
}
