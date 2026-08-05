import { withApiHandler } from "@/lib/api/handler";
import { reviewHomeworkSubmissionTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/homework-submissions/:submissionId/review — TEACHER, yalnızca kendi öğrencisi. */
export const PATCH = withApiHandler(
  async ({ ctx, params, body }) =>
    reviewHomeworkSubmissionTool(ctx, {
      ...(typeof body === "object" && body !== null ? body : {}),
      submissionId: params.submissionId,
    }),
  { permission: "homework:write" }
);
