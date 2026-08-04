import { withApiHandler } from "@/lib/api/handler";
import { reviewTeacherAvailabilityRequestTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/teachers/availability-requests/:requestId/review — yalnızca SCHOOL_ADMIN/SUPER_ADMIN. */
export const PATCH = withApiHandler(
  async ({ ctx, params, body }) =>
    reviewTeacherAvailabilityRequestTool(ctx, {
      ...(typeof body === "object" && body !== null ? body : {}),
      requestId: params.requestId,
    }),
  { permission: "availability:review" }
);
