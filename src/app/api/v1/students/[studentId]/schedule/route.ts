import { withApiHandler } from "@/lib/api/handler";
import { getStudentScheduleTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/students/:studentId/schedule */
export const GET = withApiHandler(
  async ({ ctx, params }) =>
    getStudentScheduleTool(ctx, { studentId: params.studentId }),
  { permission: "students:read" }
);
