import { withApiHandler } from "@/lib/api/handler";
import { setTeacherFeedbackSharedTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/teacher-feedback/shared { feedbackId, shared } */
export const POST = withApiHandler(
  async ({ ctx, body }) => setTeacherFeedbackSharedTool(ctx, body),
  { permission: "teacher_feedback:read" }
);
