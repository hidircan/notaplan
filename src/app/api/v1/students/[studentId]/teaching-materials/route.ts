import { withApiHandler } from "@/lib/api/handler";
import { listTeachingMaterialsForStudentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/students/:studentId/teaching-materials */
export const GET = withApiHandler(
  async ({ ctx, params }) => listTeachingMaterialsForStudentTool(ctx, { studentId: params.studentId }),
  { permission: "materials:read" }
);
