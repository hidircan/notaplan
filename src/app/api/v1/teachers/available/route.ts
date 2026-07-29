import { withApiHandler } from "@/lib/api/handler";
import { findAvailableTeachersTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/teachers/available */
export const GET = withApiHandler(
  async ({ ctx, searchParams }) =>
    findAvailableTeachersTool(ctx, {
      instrument: searchParams.get("instrument") || undefined,
      branchId: searchParams.get("branchId") || undefined,
    }),
  { permission: "teachers:read" }
);
