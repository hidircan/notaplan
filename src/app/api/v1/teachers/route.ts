import { withApiHandler } from "@/lib/api/handler";
import { createTeacherTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/teachers */
export const POST = withApiHandler(
  async ({ ctx, body }) => createTeacherTool(ctx, body),
  { permission: "teachers:write" }
);
