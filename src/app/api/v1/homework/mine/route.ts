import { withApiHandler } from "@/lib/api/handler";
import { listHomeworkForTeacherTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/homework/mine — TEACHER kendi verdiği ödevler. */
export const GET = withApiHandler(
  async ({ ctx }) => listHomeworkForTeacherTool(ctx),
  { permission: "homework:write" }
);
