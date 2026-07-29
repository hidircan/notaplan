import type { AgentLogEvent } from "./types";
import { getProviderConfig } from "../ai/config";
import { recordAiExecution } from "../ai/metrics";

/**
 * Agent telemetry hook — persists tool outcomes into AI metrics store.
 */
export function logAgentEvent(event: AgentLogEvent): void {
  if (process.env.AGENT_LOG_DEBUG === "1") {
    process.stdout.write(`[agent] ${JSON.stringify(event)}\n`);
  }

  // Persist tool terminal outcomes for observability (non-blocking)
  if (
    event.tool &&
    event.tenantId &&
    event.userId &&
    (event.type === "agent.tool_result" || event.type === "agent.tool_denied")
  ) {
    const cfg = getProviderConfig();
    void recordAiExecution({
      conversationId: event.conversationId,
      tenantId: event.tenantId,
      userId: event.userId,
      provider: cfg.name,
      model: cfg.model,
      toolName: event.tool,
      phase: "tool",
      durationMs: 0,
      success: event.outcome === "success",
      error: event.error,
      billableUnits: 1,
    });
  }
}

export function createAgentRequestId(): string {
  return `agt_${crypto.randomUUID()}`;
}
