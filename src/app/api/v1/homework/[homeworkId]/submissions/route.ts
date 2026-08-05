import { withApiHandler } from "@/lib/api/handler";
import { listHomeworkSubmissionsTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/homework/:homeworkId/submissions — ilgili öğrenci/veli/
 * öğretmen/admin (asıl kapsam tool katmanında, bkz. listHomeworkSubmissionsTool).
 */
export const GET = withApiHandler(
  async ({ ctx, params }) => listHomeworkSubmissionsTool(ctx, { homeworkId: params.homeworkId }),
  { permission: "homework:read" }
);
