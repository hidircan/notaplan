/**
 * General-purpose critical-action audit trail (EPIC 0,
 * `IMPLEMENTATION_PLAN.md`). Writes to `AuditLog` (Prisma, migration
 * `prisma/migrations/20260804125240_add_audit_log`) — distinct from
 * `src/lib/ai/audit-hook.ts`'s `AiAuditLog`, which is AI capability
 * invocations only. This covers human-triggered critical writes: payments,
 * tahsilat messages, teacher fee changes, makeup decisions, student data.
 *
 * Fire-and-forget by contract, same as `recordAiAuditLog`: every exported
 * function here CATCHES its own errors and resolves (never rejects), so
 * `void recordAuditLog(...)` is always safe and never blocks the critical
 * path it's called from.
 *
 * Same accepted limitation as `AiAuditLog`: this only persists in
 * `STORE_MODE=db` (writes go through `prisma`, which requires a real
 * MySQL/MariaDB connection). In `json`/`memory` mode the write fails closed
 * (caught, `persisted:false`) rather than throwing — documented in
 * `DEVOPS_GUIDE.md`.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { uid } from "../utils";

export type AuditOutcome = "success" | "denied" | "error";

export type AuditLogInput = {
  tenantId: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  outcome: AuditOutcome;
  /** Shape/amount/status only — never raw personal content (message bodies, notes). */
  meta?: Record<string, unknown>;
};

export type AuditLogResult = {
  id: string;
  /** False if the DB write itself failed — the function still never throws. */
  persisted: boolean;
};

function debugLog(context: string, error: unknown) {
  if (process.env.AUDIT_LOG_DEBUG === "1") {
    console.error(`[audit] ${context}`, error);
  }
}

/** Create one AuditLog row. Never throws. */
export async function recordAuditLog(input: AuditLogInput): Promise<AuditLogResult> {
  const id = uid("audit");
  try {
    await prisma.auditLog.create({
      data: {
        id,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        outcome: input.outcome,
        meta: input.meta
          ? (JSON.parse(JSON.stringify(input.meta)) as Prisma.InputJsonValue)
          : undefined,
      },
    });
    return { id, persisted: true };
  } catch (error) {
    debugLog("failed to write AuditLog", error);
    return { id, persisted: false };
  }
}

export type AuditLogEntry = {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  outcome: AuditOutcome;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

/**
 * Tenant-scoped read for the admin "Denetim Kaydı" screen. Never throws —
 * returns `[]` on any DB error (e.g. STORE_MODE=json/memory, where AuditLog
 * was never written to).
 */
export async function listAuditLogs(
  tenantId: string,
  opts?: { limit?: number; action?: string; entityType?: string }
): Promise<AuditLogEntry[]> {
  try {
    const rows = await prisma.auditLog.findMany({
      where: {
        tenantId,
        action: opts?.action,
        entityType: opts?.entityType,
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 100,
    });
    return rows.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId,
      actorRole: r.actorRole,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      outcome: r.outcome as AuditOutcome,
      meta: (r.meta as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    debugLog("failed to read AuditLog", error);
    return [];
  }
}
