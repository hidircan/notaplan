import type { AuditEvent } from "./types";
import { recordAuditLog } from "../audit/log";

/**
 * Auth-layer audit hook (login success/failure, permission denials, request
 * errors). Signature is unchanged from before EPIC 0 — callers do not await
 * this, it stays synchronous — but it now actually persists (fire-and-forget)
 * via `recordAuditLog` (`AuditLog` table) instead of being a no-op. Events
 * without a `tenantId` (e.g. a login attempt with an unknown email — there is
 * no tenant to scope to yet) are intentionally NOT persisted, matching the
 * "no DEFAULT_TENANT_ID fallback" rule the rest of the audit trail follows;
 * they still reach the debug log below.
 */
export function auditLog(event: AuditEvent): void {
  if (process.env.AUDIT_LOG_DEBUG === "1") {
    process.stdout.write(`[audit] ${JSON.stringify(event)}\n`);
  }
  if (!event.tenantId) return;
  void recordAuditLog({
    tenantId: event.tenantId,
    actorUserId: event.userId ?? "anonymous",
    actorRole: event.role ?? "unknown",
    action: event.action,
    entityType: "Auth",
    entityId: event.userId ?? event.requestId,
    outcome: event.outcome,
    meta: {
      requestId: event.requestId,
      path: event.path,
      method: event.method,
      ...event.meta,
    },
  });
}
