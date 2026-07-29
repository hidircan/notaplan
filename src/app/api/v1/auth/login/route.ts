import { z } from "zod";
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { jsonFail } from "@/lib/api/http";
import { authenticateUser, issueTokenPair, auditLog } from "@/lib/auth";
import { applyAuthCookies } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/v1/auth/login
 * Public — JWT pair in body + HttpOnly cookies for web.
 */
export const POST = withApiHandler(
  async ({ body, ctx }) => {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFail("VALIDATION_ERROR", "Invalid login payload", parsed.error.flatten());
    }

    const user = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!user) {
      auditLog({
        action: "auth.login_failed",
        requestId: ctx.requestId || "unknown",
        outcome: "denied",
        meta: { email: parsed.data.email },
      });
      return jsonFail("UNAUTHORIZED", "Invalid email or password");
    }

    const tokens = await issueTokenPair(user);
    auditLog({
      action: "auth.login_success",
      requestId: ctx.requestId || "unknown",
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      outcome: "success",
    });

    const res = NextResponse.json({
      ok: true as const,
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          teacherId: user.teacherId,
          studentId: user.studentId,
        },
        ...tokens,
      },
    });
    applyAuthCookies(res, tokens);
    return res;
  },
  { public: true }
);
