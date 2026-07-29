import { withApiHandler } from "@/lib/api/handler";
import { markAttendanceTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/attendance */
export const POST = withApiHandler(
  async ({ ctx, body }) => markAttendanceTool(ctx, body),
  { permission: "attendance:write" }
);
