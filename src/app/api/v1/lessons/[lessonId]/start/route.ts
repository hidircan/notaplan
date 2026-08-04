import { withApiHandler } from "@/lib/api/handler";
import { startLessonTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/lessons/:lessonId/start — TEACHER yalnızca kendi dersi. */
export const POST = withApiHandler(
  async ({ ctx, params }) => startLessonTool(ctx, { lessonId: params.lessonId }),
  { permission: "attendance:write" }
);
