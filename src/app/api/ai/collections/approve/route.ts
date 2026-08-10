import { z } from "zod";
import { withApiHandler } from "@/lib/api/handler";
import { ok, fail } from "@/lib/services/result";
import { recordApprovalDecision } from "@/lib/ai/audit-hook";
import { auditLog } from "@/lib/auth/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/collections/approve
 *
 * This route ONLY records an approval/rejection decision on the invocation's
 * `AiAuditLog` row. It NEVER sends anything — a `requiresApproval:true`
 * capability (e.g. `collectionsMessageDraft`) stays `pending_approval` until
 * a human calls this, and even after approval, sending remains the existing,
 * untouched Tahsilat UI flow (wa.me deep link, human-triggered) per
 * US-05/AC-11/AC-12. This route cannot and does not auto-send.
 *
 * `tenantId` comes only from the session — `recordApprovalDecision` scopes
 * its update by (`invocationId`, `tenantId`), so a forged/stale
 * `invocationId` from another tenant is never matched or leaked.
 */
const bodySchema = z.object({
  invocationId: z.string().min(1),
  approved: z.boolean(),
  editedContent: z.string().optional(),
});

export const POST = withApiHandler(async ({ ctx, body }) => {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Geçersiz istek gövdesi");
  }
  const { invocationId, approved, editedContent } = parsed.data;

  const result = await recordApprovalDecision({
    invocationId,
    tenantId: ctx.tenantId,
    approvalStatus: approved ? "approved" : "rejected",
    approvedBy: ctx.userId,
  });

  if (!result.ok) {
    return fail("NOT_FOUND", result.error);
  }

  // `editedContent` has no AiAuditLog column in this sprint (schema is the
  // exact set specified — no new columns added). Recorded via the existing
  // lightweight audit hook for visibility only; never the raw text itself,
  // consistent with "never log raw payloads/messages/payment details".
  auditLog({
    action: "ai.collections.approval",
    requestId: ctx.requestId ?? invocationId,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    role: ctx.role,
    outcome: approved ? "success" : "denied",
    meta: { invocationId, approved, hasEditedContent: Boolean(editedContent) },
  });

  return ok({ invocationId, approvalStatus: approved ? "approved" : "rejected" });
});
