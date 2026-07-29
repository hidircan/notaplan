import { withApiHandler } from "@/lib/api/handler";
import { getTeacherScheduleTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/teachers/:teacherId/schedule */
export const GET = withApiHandler(
  async ({ ctx, params }) =>
    getTeacherScheduleTool(ctx, { teacherId: params.teacherId }),
  { permission: "teachers:read" }
);
