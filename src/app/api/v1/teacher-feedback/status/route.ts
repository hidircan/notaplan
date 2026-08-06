import { withApiHandler } from "@/lib/api/handler";
import { updateTeacherFeedbackStatusTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/teacher-feedback/status { feedbackId, status } */
export const POST = withApiHandler(
  async ({ ctx, body }) => updateTeacherFeedbackStatusTool(ctx, body),
  { permission: "teacher_feedback:read" }
);
