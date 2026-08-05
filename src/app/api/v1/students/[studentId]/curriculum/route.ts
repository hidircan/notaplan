import { withApiHandler } from "@/lib/api/handler";
import { listCurriculumForStudentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/students/:studentId/curriculum — sahiplik + özet/detay. */
export const GET = withApiHandler(
  async ({ ctx, params }) => listCurriculumForStudentTool(ctx, { studentId: params.studentId }),
  { permission: "curriculum:read" }
);
