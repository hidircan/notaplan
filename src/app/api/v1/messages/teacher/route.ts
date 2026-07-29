import { withApiHandler } from "@/lib/api/handler";
import { sendTeacherMessageTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/messages/teacher */
export const POST = withApiHandler(
  async ({ ctx, body }) => sendTeacherMessageTool(ctx, body),
  { permission: "messages:send" }
);
