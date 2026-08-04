import { withApiHandler } from "@/lib/api/handler";
import { listTeacherAvailabilityRequestsTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/teachers/:teacherId/availability-requests — TEACHER yalnızca
 * kendi kayıtları, SCHOOL_ADMIN/SUPER_ADMIN herhangi biri (asıl TEACHER-own
 * kısıtlaması tool katmanında, bkz. listTeacherAvailabilityRequestsTool).
 */
export const GET = withApiHandler(
  async ({ ctx, params }) =>
    listTeacherAvailabilityRequestsTool(ctx, { teacherId: params.teacherId }),
  { permission: "teachers:read" }
);
