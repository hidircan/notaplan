import { withApiHandler } from "@/lib/api/handler";
import { endLessonTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/lessons/:lessonId/end — TEACHER yalnızca kendi dersi. */
export const POST = withApiHandler(
  async ({ ctx, params }) => endLessonTool(ctx, { lessonId: params.lessonId }),
  { permission: "attendance:write" }
);
