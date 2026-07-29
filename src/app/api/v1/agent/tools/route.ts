import { withApiHandler } from "@/lib/api/handler";
import { listToolsForRole } from "@/lib/agent";
import { ok } from "@/lib/services/result";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/agent/tools
 * Returns tools the caller may invoke (Agent / MCP discovery).
 */
export const GET = withApiHandler(
  async ({ ctx }) => {
    return ok({
      tools: listToolsForRole(ctx.role),
      channelHints: ["web_chat", "whatsapp", "voice", "mobile", "mcp", "api"],
    });
  },
  { permission: "tools:catalog" }
);
