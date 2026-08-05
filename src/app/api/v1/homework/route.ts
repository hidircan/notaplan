import { withApiHandler } from "@/lib/api/handler";
import { createHomeworkTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/homework — TEACHER, yalnızca kendi öğrencisi için. */
export const POST = withApiHandler(
  async ({ ctx, body }) => createHomeworkTool(ctx, body),
  { permission: "homework:write" }
);
