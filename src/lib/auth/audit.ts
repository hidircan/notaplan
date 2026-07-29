import type { AuditEvent } from "./types";

/**
 * Audit logging hook — no implementation yet.
 * Future: persist to DB / SIEM / analytics.
 */
export function auditLog(event: AuditEvent): void {
  // intentionally empty — hook for future persistence
  void event;
  if (process.env.AUDIT_LOG_DEBUG === "1") {
    process.stdout.write(`[audit] ${JSON.stringify(event)}\n`);
  }
}
