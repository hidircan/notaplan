import { withApiHandler } from "@/lib/api/handler";
import { revealTeacherFeedbackIdentityTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/teacher-feedback/reveal-identity { feedbackId, reason } */
export const POST = withApiHandler(
  async ({ ctx, body }) => revealTeacherFeedbackIdentityTool(ctx, body),
  { permission: "teacher_feedback:read" }
);
