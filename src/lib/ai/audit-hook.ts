/**
 * AI capability invocation audit trail — writes to `AiAuditLog` (Prisma,
 * migration `prisma/migrations/20260802152131_add_ai_audit_log`).
 *
 * Fire-and-forget by contract: every exported function here CATCHES its own
 * errors and resolves (never rejects), so `void recordAiAuditLog(...)` is
 * always safe. Callers that need a guarantee the row exists (e.g. the
 * collections API route, before it hands out an `invocationId` a later
 * approval call must find) may `await` the same call — awaiting a promise
 * that never rejects is safe and does not reintroduce a throw path.
 *
 * No `DEFAULT_TENANT_ID` fallback: `tenantId` is a required, caller-supplied
 * field (from JWT/session), never defaulted here.
 */
import { prisma } from "../db";
import { uid } from "../utils";
import type { AppRole } from "../auth/types";

export type AiApprovalStatus = "not_required" | "pending_approval" | "approved" | "rejected";

export type AiAuditRecordInput = {
  /** Pass the same id back in to update-in-place (upsert) instead of creating a new row. */
  id?: string;
  tenantId: string;
  capabilityId: string;
  callerRole: AppRole;
  chosenProvider: string;
  usedFallback: boolean;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  approvalStatus?: AiApprovalStatus;
};

export type AiAuditRecordResult = {
  id: string;
  /** False if the DB write itself failed — the function still never throws. */
  persisted: boolean;
};

function debugLog(context: string, error: unknown) {
  if (process.env.AUDIT_LOG_DEBUG === "1") {
    console.error(`[ai-audit] ${context}`, error);
  }
}

/** Create (or upsert, if `id` is passed) one AiAuditLog row. Never throws. */
export async function recordAiAuditLog(input: AiAuditRecordInput): Promise<AiAuditRecordResult> {
  const id = input.id ?? uid("aiaudit");
  const data = {
    tenantId: input.tenantId,
    capabilityId: input.capabilityId,
    callerRole: input.callerRole,
    chosenProvider: input.chosenProvider,
    usedFallback: input.usedFallback,
    success: input.success,
    errorMessage: input.errorMessage,
    durationMs: input.durationMs,
    approvalStatus: input.approvalStatus ?? "not_required",
  };

  try {
    await prisma.aiAuditLog.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    return { id, persisted: true };
  } catch (error) {
    debugLog("failed to write AiAuditLog", error);
    return { id, persisted: false };
  }
}

export type AiAuditLogEntry = {
  id: string;
  capabilityId: string;
  callerRole: string;
  chosenProvider: string;
  usedFallback: boolean;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  approvalStatus: AiApprovalStatus;
  approvedBy: string | null;
  createdAt: Date;
};

/**
 * Tenant-scoped read of capability invocation history, for the admin
 * "AI Logları" screen. Never throws — returns `[]` on any DB error (e.g.
 * STORE_MODE=json/memory, where `AiAuditLog` was never written to).
 */
export async function listAiAuditLogs(tenantId: string, limit = 100): Promise<AiAuditLogEntry[]> {
  try {
    const rows = await prisma.aiAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      capabilityId: r.capabilityId,
      callerRole: r.callerRole,
      chosenProvider: r.chosenProvider,
      usedFallback: r.usedFallback,
      success: r.success,
      errorMessage: r.errorMessage,
      durationMs: r.durationMs,
      approvalStatus: r.approvalStatus as AiApprovalStatus,
      approvedBy: r.approvedBy,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    debugLog("failed to read AiAuditLog", error);
    return [];
  }
}

export type ApprovalDecisionInput = {
  invocationId: string;
  /** Tenant-scoped update — an invocation from another tenant is never matched. */
  tenantId: string;
  approvalStatus: "approved" | "rejected";
  approvedBy: string;
};

export type ApprovalDecisionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Updates an existing invocation's approval decision. Tenant-scoped
 * (`updateMany` with `id` + `tenantId` in the WHERE) so a forged/stale
 * `invocationId` can never touch another tenant's row. Never throws.
 */
export async function recordApprovalDecision(
  input: ApprovalDecisionInput
): Promise<ApprovalDecisionResult> {
  try {
    const result = await prisma.aiAuditLog.updateMany({
      where: { id: input.invocationId, tenantId: input.tenantId },
      data: {
        approvalStatus: input.approvalStatus,
        approvedAt: new Date(),
        approvedBy: input.approvedBy,
      },
    });
    if (result.count === 0) {
      return { ok: false, error: "Invocation bulunamadı veya bu kuruma ait değil." };
    }
    return { ok: true };
  } catch (error) {
    debugLog("failed to update AiAuditLog approval", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Onay güncellemesi başarısız.",
    };
  }
}
