import { withApiHandler } from "@/lib/api/handler";
import { getParentBalanceTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/students/:studentId/balance */
export const GET = withApiHandler(
  async ({ ctx, params }) =>
    getParentBalanceTool(ctx, { studentId: params.studentId }),
  { permission: "students:read" }
);
