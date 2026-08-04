import { withApiHandler } from "@/lib/api/handler";
import { createAssessmentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/assessments — TEACHER yalnızca kendi öğrencisi için oluşturabilir. */
export const POST = withApiHandler(
  async ({ ctx, body }) => createAssessmentTool(ctx, body),
  { permission: "assessments:write" }
);
