import { z } from "zod";
import { withApiHandler } from "@/lib/api/handler";
import { jsonFail, fromServiceResult } from "@/lib/api/http";
import { runChatTurn } from "@/lib/ai";
import { createConversation, listConversations } from "@/lib/ai/conversations";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
});

/** GET /api/v1/chat — list conversations for current user/tenant */
export const GET = withApiHandler(
  async ({ ctx }) => {
    const items = await listConversations(ctx.tenantId, ctx.userId);
    return fromServiceResult({
      ok: true,
      data: {
        conversations: items.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          messageCount: c.messages.length,
        })),
      },
    });
  },
  { permission: "tools:catalog" }
);

/** POST /api/v1/chat — send message, orchestrate tools via Agent Runtime */
export const POST = withApiHandler(
  async ({ ctx, body }) => {
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFail("VALIDATION_ERROR", "Invalid chat payload", parsed.error.flatten());
    }

    try {
      const result = await runChatTurn({
        ctx: { ...ctx, channel: "chat" },
        conversationId: parsed.data.conversationId,
        message: parsed.data.message,
      });

      return fromServiceResult({
        ok: true,
        data: {
          conversationId: result.conversation.id,
          provider: result.provider,
          messages: result.conversation.messages,
          assistantMessage: result.assistantMessage,
          toolMessages: result.toolMessages,
        },
      });
    } catch (e) {
      return jsonFail(
        "INTERNAL_ERROR",
        e instanceof Error ? e.message : "Chat failed"
      );
    }
  },
  { permission: "tools:catalog" }
);

// ensure createConversation is tree-shaken only if used — keep import used for types
void createConversation;
