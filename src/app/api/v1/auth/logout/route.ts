import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { auditLog } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/v1/auth/logout — clear HttpOnly session cookies */
export const POST = withApiHandler(
  async ({ ctx }) => {
    auditLog({
      action: "auth.logout",
      requestId: ctx.requestId || "unknown",
      userId: ctx.userId !== "anonymous" ? ctx.userId : undefined,
      tenantId: ctx.tenantId !== "public" ? ctx.tenantId : undefined,
      outcome: "success",
    });
    const res = NextResponse.json({ ok: true as const, data: { loggedOut: true } });
    clearAuthCookies(res);
    return res;
  },
  { public: true }
);
