import { withApiHandler } from "@/lib/api/handler";
import { correctLessonTimesTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/lessons/:lessonId/correct — yalnızca SCHOOL_ADMIN/SUPER_ADMIN.
 * body: { actualStartAt?, actualEndAt?, note } — note zorunlu.
 */
export const PATCH = withApiHandler(
  async ({ ctx, params, body }) =>
    correctLessonTimesTool(ctx, {
      ...(typeof body === "object" && body !== null ? body : {}),
      lessonId: params.lessonId,
    }),
  { permission: "students:write" }
);
