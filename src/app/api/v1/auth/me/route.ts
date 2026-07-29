import { withApiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/services/result";

export const dynamic = "force-dynamic";

/** GET /api/v1/auth/me — current principal from JWT */
export const GET = withApiHandler(async ({ ctx }) => {
  return ok({
    userId: ctx.userId,
    role: ctx.role,
    tenantId: ctx.tenantId,
    teacherId: ctx.teacherId,
    studentId: ctx.studentId,
    channel: ctx.channel,
    requestId: ctx.requestId,
  });
});
