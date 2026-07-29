import { withApiHandler } from "@/lib/api/handler";
import { createStudentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/students */
export const POST = withApiHandler(
  async ({ ctx, body }) => createStudentTool(ctx, body),
  { permission: "students:write" }
);
