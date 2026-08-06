import { withApiHandler } from "@/lib/api/handler";
import { getOwnTeacherFeedbackSummaryTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/teacher-feedback/summary — öğretmenin kendi anonim özeti. */
export const GET = withApiHandler(
  async ({ ctx }) => getOwnTeacherFeedbackSummaryTool(ctx),
  { permission: "teacher_feedback:summary" }
);
