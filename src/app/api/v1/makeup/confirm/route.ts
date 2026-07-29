import { withApiHandler } from "@/lib/api/handler";
import { confirmMakeupLessonTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/makeup/confirm */
export const POST = withApiHandler(
  async ({ ctx, body }) => confirmMakeupLessonTool(ctx, body),
  { permission: "makeup:write" }
);
