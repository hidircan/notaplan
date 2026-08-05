import { withApiHandler } from "@/lib/api/handler";
import { createTeachingMaterialTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/teaching-materials — TEACHER kendi öğrencilerine materyal paylaşır. */
export const POST = withApiHandler(
  async ({ ctx, body }) => createTeachingMaterialTool(ctx, body),
  { permission: "materials:write" }
);
