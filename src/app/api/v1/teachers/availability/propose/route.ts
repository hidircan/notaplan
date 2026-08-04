import { withApiHandler } from "@/lib/api/handler";
import { proposeTeacherAvailabilityTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/teachers/availability/propose — TEACHER, yalnızca kendisi için. */
export const POST = withApiHandler(
  async ({ ctx, body }) => proposeTeacherAvailabilityTool(ctx, body),
  { permission: "availability:propose" }
);
