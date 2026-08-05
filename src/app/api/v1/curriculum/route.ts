import { withApiHandler } from "@/lib/api/handler";
import { createCurriculumTopicTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/curriculum — TEACHER, yalnızca kendi öğrencisi için konu ekler. */
export const POST = withApiHandler(
  async ({ ctx, body }) => createCurriculumTopicTool(ctx, body),
  { permission: "curriculum:write" }
);
