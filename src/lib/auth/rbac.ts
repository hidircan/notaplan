import type { AppRole } from "./types";

/**
 * Permission catalog — endpoint / capability level.
 * Tools also enforce roles; this is the API gate.
 */
export type Permission =
  | "attendance:write"
  | "makeup:read"
  | "makeup:write"
  | "teachers:read"
  | "teachers:write"
  | "students:read"
  | "students:write"
  | "payments:write"
  | "messages:send"
  | "tools:catalog"
  | "demo:reset"
  | "tenant:all";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  SUPER_ADMIN: [
    "attendance:write",
    "makeup:read",
    "makeup:write",
    "teachers:read",
    "teachers:write",
    "students:read",
    "students:write",
    "payments:write",
    "messages:send",
    "tools:catalog",
    "demo:reset",
    "tenant:all",
  ],
  SCHOOL_ADMIN: [
    "attendance:write",
    "makeup:read",
    "makeup:write",
    "teachers:read",
    "teachers:write",
    "students:read",
    "students:write",
    "payments:write",
    "messages:send",
    "tools:catalog",
    "demo:reset",
  ],
  TEACHER: [
    "attendance:write",
    "makeup:read",
    "makeup:write",
    "teachers:read",
    "students:read",
    "messages:send",
    "tools:catalog",
  ],
  PARENT: ["students:read", "tools:catalog"],
  AI_AGENT: [
    "attendance:write",
    "makeup:read",
    "makeup:write",
    "teachers:read",
    "teachers:write",
    "students:read",
    "students:write",
    "payments:write",
    "messages:send",
    "tools:catalog",
  ],
};

export function hasPermission(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(
  role: AppRole,
  permission: Permission
): { ok: true } | { ok: false; message: string } {
  if (hasPermission(role, permission)) return { ok: true };
  return {
    ok: false,
    message: `Role ${role} lacks permission ${permission}`,
  };
}
