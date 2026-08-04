/**
 * Caller identity for authorization.
 * Roles align with production RBAC (JWT claims).
 */

import type { AppRole } from "../auth/types";
import { DEFAULT_TENANT_ID } from "../auth/config";

export type ActorRole = AppRole;

export type ServiceContext = {
  role: ActorRole;
  userId: string;
  /** Always from JWT (or trusted web session) — never from client spoof */
  tenantId: string;
  teacherId?: string;
  studentId?: string;
  channel?: "web" | "mobile" | "chat" | "whatsapp" | "voice" | "mcp";
  requestId?: string;
};

/**
 * @deprecated UI must use session JWT context (Milestone 5).
 * Kept only for non-UI scripts / tests.
 */
export const WEB_ADMIN_CONTEXT: ServiceContext = {
  role: "SCHOOL_ADMIN",
  userId: "web_admin",
  tenantId: DEFAULT_TENANT_ID,
  channel: "web",
};

const STAFF: AppRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "AI_AGENT"];

export function requireRole(
  ctx: ServiceContext,
  allowed: ActorRole[]
): { ok: true } | { ok: false; message: string } {
  if (allowed.includes(ctx.role)) {
    return { ok: true };
  }
  // SUPER_ADMIN bypasses role gates
  if (ctx.role === "SUPER_ADMIN") {
    return { ok: true };
  }
  return {
    ok: false,
    message: `Role '${ctx.role}' is not allowed. Need one of: ${allowed.join(", ")}`,
  };
}

export function canAccessStudent(ctx: ServiceContext, studentId: string): boolean {
  if (ctx.role === "SUPER_ADMIN" || ctx.role === "SCHOOL_ADMIN" || ctx.role === "AI_AGENT") {
    return true;
  }
  if (ctx.role === "PARENT" || ctx.role === "STUDENT") return ctx.studentId === studentId;
  if (ctx.role === "TEACHER") return true; // filtered by schedule ownership in tools where needed
  return false;
}

export function canAccessTeacher(ctx: ServiceContext, teacherId: string): boolean {
  if (ctx.role === "SUPER_ADMIN" || ctx.role === "SCHOOL_ADMIN" || ctx.role === "AI_AGENT") {
    return true;
  }
  if (ctx.role === "TEACHER") return ctx.teacherId === teacherId;
  return false;
}

export function isStaff(ctx: ServiceContext): boolean {
  return STAFF.includes(ctx.role);
}
