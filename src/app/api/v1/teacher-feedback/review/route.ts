import { withApiHandler } from "@/lib/api/handler";
import { listTeacherFeedbackForReviewTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/teacher-feedback/review — maskeli liste (SCHOOL_ADMIN/SUPER_ADMIN). */
export const GET = withApiHandler(
  async ({ ctx, searchParams }) =>
    listTeacherFeedbackForReviewTool(ctx, {
      teacherId: searchParams.get("teacherId") || undefined,
      status: searchParams.get("status") || undefined,
      sourceType: searchParams.get("sourceType") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    }),
  { permission: "teacher_feedback:read" }
);
