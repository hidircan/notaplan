/**
 * Agent Executor — validates, authorizes, runs Tool Layer only.
 * Safe for Web Chat, WhatsApp, Voice, Mobile AI, MCP (later).
 */

import type { ServiceContext } from "../services/context";
import { runWithTenantAsync } from "../tenant-context";
import { getTool, isRegisteredTool, listToolDefinitions } from "./registry";
import { createAgentRequestId, logAgentEvent } from "./logging";
import type {
  AgentExecuteRequest,
  AgentExecuteResponse,
  AgentToolName,
} from "./types";

/**
 * Execute a single tool call on behalf of an authenticated agent/user.
 * Never opens a DB connection — tools handle persistence via store.
 */
export async function executeAgentTool(
  ctx: ServiceContext,
  request: AgentExecuteRequest
): Promise<AgentExecuteResponse> {
  const requestId = ctx.requestId || createAgentRequestId();
  const { tool, input, conversationId, messageId, channel } = request;

  const baseLog = {
    requestId,
    conversationId,
    messageId,
    channel: channel ?? mapChannel(ctx.channel),
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    role: ctx.role,
    tool,
    at: new Date().toISOString(),
  } as const;

  if (!isRegisteredTool(tool)) {
    logAgentEvent({
      ...baseLog,
      type: "agent.tool_denied",
      outcome: "denied",
      error: `Unknown tool: ${tool}`,
    });
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: `Unknown tool: ${tool}` },
      conversationId,
      messageId,
      requestId,
    };
  }

  const def = getTool(tool)!;

  if (!def.requiredRoles.includes(ctx.role) && ctx.role !== "SUPER_ADMIN") {
    logAgentEvent({
      ...baseLog,
      type: "agent.tool_denied",
      outcome: "denied",
      error: `Role ${ctx.role} cannot invoke ${tool}`,
      meta: { requiredRoles: def.requiredRoles },
    });
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: `Role ${ctx.role} cannot invoke ${tool}`,
        details: { requiredRoles: def.requiredRoles },
      },
      conversationId,
      messageId,
      requestId,
    };
  }

  const parsed = def.inputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    logAgentEvent({
      ...baseLog,
      type: "agent.tool_denied",
      outcome: "denied",
      error: "VALIDATION_ERROR",
      input,
      meta: { issues: parsed.error.flatten() },
    });
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid tool input",
        details: parsed.error.flatten(),
      },
      conversationId,
      messageId,
      requestId,
    };
  }

  logAgentEvent({
    ...baseLog,
    type: "agent.tool_call",
    outcome: "success",
    input: parsed.data,
  });

  try {
    const toolCtx: ServiceContext = { ...ctx, requestId, channel: ctx.channel ?? "mcp" };
    const result = await runWithTenantAsync(ctx.tenantId, () =>
      def.execute(toolCtx, parsed.data)
    );

    if (!result.ok) {
      logAgentEvent({
        ...baseLog,
        type: "agent.tool_result",
        outcome: "error",
        error: result.error.message,
        meta: { code: result.error.code },
      });
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
        },
        conversationId,
        messageId,
        requestId,
      };
    }

    logAgentEvent({
      ...baseLog,
      type: "agent.tool_result",
      outcome: "success",
    });

    return {
      ok: true,
      data: {
        tool: tool as AgentToolName,
        result: result.data,
        conversationId,
        messageId,
        requestId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent execution failed";
    logAgentEvent({
      ...baseLog,
      type: "agent.error",
      outcome: "error",
      error: message,
    });
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message },
      conversationId,
      messageId,
      requestId,
    };
  }
}

/** List tools available to a given role (for LLM system prompts / MCP list_tools) */
export function listToolsForRole(role: ServiceContext["role"]) {
  return listToolDefinitions().filter(
    (t) => role === "SUPER_ADMIN" || t.requiredRoles.includes(role)
  );
}

function mapChannel(
  ch?: ServiceContext["channel"]
): import("./types").AgentChannel | undefined {
  if (!ch) return undefined;
  if (ch === "whatsapp") return "whatsapp";
  if (ch === "voice") return "voice";
  if (ch === "mobile") return "mobile";
  if (ch === "mcp") return "mcp";
  if (ch === "chat") return "web_chat";
  return "api";
}
