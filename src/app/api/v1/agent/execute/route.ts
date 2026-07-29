import { z } from "zod";
import { withApiHandler } from "@/lib/api/handler";
import { jsonFail, fromServiceResult } from "@/lib/api/http";
import { executeAgentTool, isRegisteredTool } from "@/lib/agent";
import type { AgentToolName } from "@/lib/agent";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tool: z.string().min(1),
  input: z.unknown().optional(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  channel: z
    .enum(["web_chat", "whatsapp", "voice", "mobile", "mcp", "api"])
    .optional(),
});

/**
 * POST /api/v1/agent/execute
 * Agent Runtime entry — JWT + RBAC + Tool Layer only.
 */
export const POST = withApiHandler(
  async ({ ctx, body }) => {
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonFail("VALIDATION_ERROR", "Invalid agent execute payload", parsed.error.flatten());
    }
    if (!isRegisteredTool(parsed.data.tool)) {
      return jsonFail("NOT_FOUND", `Unknown tool: ${parsed.data.tool}`);
    }

    const response = await executeAgentTool(
      { ...ctx, channel: ctx.channel ?? "mcp" },
      {
        tool: parsed.data.tool as AgentToolName,
        input: parsed.data.input,
        conversationId: parsed.data.conversationId,
        messageId: parsed.data.messageId,
        channel: parsed.data.channel,
      }
    );

    // Map agent envelope → API ServiceResult shape for consistency
    if (response.ok) {
      return fromServiceResult({ ok: true, data: response.data });
    }
    return jsonFail(
      response.error.code as "FORBIDDEN",
      response.error.message,
      response.error.details
    );
  },
  { permission: "tools:catalog" }
);
