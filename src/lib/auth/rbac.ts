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
  | "tenant:all"
  | "export:institution"
  | "notifications:read"
  | "communication:write"
  | "announcements:read"
  | "announcements:write"
  | "assessments:read"
  | "assessments:write"
  | "availability:propose"
  | "availability:review";

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
    "export:institution",
    "notifications:read",
    "communication:write",
    "announcements:read",
    "announcements:write",
    "assessments:read",
    "assessments:write",
    "availability:review",
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
    "export:institution",
    "notifications:read",
    "communication:write",
    "announcements:read",
    "announcements:write",
    "assessments:read",
    "assessments:write",
    "availability:review",
  ],
  TEACHER: [
    "attendance:write",
    "makeup:read",
    "makeup:write",
    "teachers:read",
    "students:read",
    "messages:send",
    "tools:catalog",
    "notifications:read",
    "announcements:read",
    "assessments:read",
    "assessments:write",
    "availability:propose",
  ],
  PARENT: [
    "students:read",
    "tools:catalog",
    "notifications:read",
    "communication:write",
    "announcements:read",
    "assessments:read",
  ],
  /**
   * EPIC 6A (IMPLEMENTATION_PLAN.md) — bilinçli olarak dar bir izin seti:
   * yalnızca kendi verisini OKUR (canAccessStudent ile kapsamlanır),
   * hiçbir şey YAZAMAZ (opt-out/mesajlaşma/ödeme veli veya admin kararıdır).
   */
  STUDENT: [
    "students:read",
    "tools:catalog",
    "notifications:read",
    "announcements:read",
    "assessments:read",
  ],
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
    "notifications:read",
    "communication:write",
    "announcements:read",
    "assessments:read",
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
