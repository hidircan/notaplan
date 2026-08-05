import { withApiHandler } from "@/lib/api/handler";
import { listTeachingMaterialsForTeacherTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/teaching-materials/mine — TEACHER kendi paylaştığı materyaller. */
export const GET = withApiHandler(
  async ({ ctx }) => listTeachingMaterialsForTeacherTool(ctx),
  { permission: "materials:write" }
);
