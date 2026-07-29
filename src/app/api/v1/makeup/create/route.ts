import { withApiHandler } from "@/lib/api/handler";
import { createMakeupLessonTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/makeup/create */
export const POST = withApiHandler(
  async ({ ctx, body }) => createMakeupLessonTool(ctx, body),
  { permission: "makeup:write" }
);
