import { withApiHandler } from "@/lib/api/handler";
import { listHomeworkForStudentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/students/:studentId/homework */
export const GET = withApiHandler(
  async ({ ctx, params }) => listHomeworkForStudentTool(ctx, { studentId: params.studentId }),
  { permission: "homework:read" }
);
