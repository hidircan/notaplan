import { withApiHandler } from "@/lib/api/handler";
import { sendParentMessageTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/messages/parent */
export const POST = withApiHandler(
  async ({ ctx, body }) => sendParentMessageTool(ctx, body),
  { permission: "messages:send" }
);
