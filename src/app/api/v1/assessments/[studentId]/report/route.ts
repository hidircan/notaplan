import { withApiHandler } from "@/lib/api/handler";
import { getAssessmentReportTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/assessments/:studentId/report — 4 haftalık birleşik rapor + trend. */
export const GET = withApiHandler(
  async ({ ctx, params }) => getAssessmentReportTool(ctx, { studentId: params.studentId }),
  { permission: "assessments:read" }
);
