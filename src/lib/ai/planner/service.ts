/**
 * Guardrailed planner. It turns already-authorized LLM tool calls into an
 * explicit, bounded execution plan. It never executes tools itself.
 */
import { isRegisteredTool } from "../../agent";
import type { AgentToolName } from "../../agent/types";
import type { AgentPlan, PlanStep } from "./types";

const MAX_STEPS = Math.max(1, Number(process.env.PLANNER_MAX_STEPS || 5));
const MAX_RETRIES = Math.max(0, Number(process.env.PLANNER_MAX_RETRIES || 1));

export function createExecutionPlan(args: {
  conversationId: string;
  objective: string;
  toolCalls: Array<{ tool: AgentToolName; input: unknown }>;
}): AgentPlan {
  const steps: PlanStep[] = args.toolCalls
    .filter((call) => isRegisteredTool(call.tool))
    .slice(0, MAX_STEPS)
    .map((call, index) => ({
      id: `step_${index + 1}`,
      objective: `Execute ${call.tool}`,
      tool: call.tool,
      input: call.input,
      dependsOn: index ? [`step_${index}`] : undefined,
      condition: index ? "previous_success" : "always",
      maxRetries: MAX_RETRIES,
      onFailure: "stop",
      status: "pending",
    }));

  return {
    id: `plan_${crypto.randomUUID()}`,
    conversationId: args.conversationId,
    objective: args.objective.slice(0, 500),
    steps,
    createdAt: new Date().toISOString(),
    revision: 0,
  };
}

export function getExecutableToolCalls(plan: AgentPlan): Array<{ tool: AgentToolName; input: unknown }> {
  const calls: Array<{ tool: AgentToolName; input: unknown }> = [];
  for (const step of plan.steps) {
    if (step.condition === "previous_success" && calls.length === 0) break;
    calls.push({ tool: step.tool, input: step.input });
  }
  return calls;
}
