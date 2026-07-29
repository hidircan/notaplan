import { withApiHandler } from "@/lib/api/handler";
import { cancelMakeupLessonTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/makeup/cancel */
export const POST = withApiHandler(
  async ({ ctx, body }) => cancelMakeupLessonTool(ctx, body),
  { permission: "makeup:write" }
);
