import { withApiHandler } from "@/lib/api/handler";
import { listAssessmentsForStudentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/assessments/:studentId — parentPrivateNote sunucu tarafında elenir. */
export const GET = withApiHandler(
  async ({ ctx, params }) => listAssessmentsForStudentTool(ctx, { studentId: params.studentId }),
  { permission: "assessments:read" }
);
