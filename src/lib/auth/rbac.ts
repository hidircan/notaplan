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
  | "availability:review"
  | "homework:read"
  | "homework:write"
  | "homework:submit"
  | "materials:read"
  | "materials:write"
  | "teacher_feedback:submit"
  | "teacher_feedback:read"
  | "curriculum:read"
  | "curriculum:write";

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
    "homework:read",
    "materials:read",
    "teacher_feedback:read",
    "curriculum:read",
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
    "homework:read",
    "materials:read",
    "teacher_feedback:read",
    "curriculum:read",
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
    "homework:read",
    "homework:write",
    "materials:read",
    "materials:write",
    "curriculum:read",
    "curriculum:write",
  ],
  PARENT: [
    "students:read",
    "tools:catalog",
    "notifications:read",
    "communication:write",
    "announcements:read",
    "assessments:read",
    "homework:read",
    "materials:read",
    "teacher_feedback:submit",
    "curriculum:read",
  ],
  /**
   * EPIC 6A — bilinçli olarak dar bir izin seti: yalnızca kendi verisini
   * OKUR (canAccessStudent ile kapsamlanır); opt-out/mesajlaşma/ödeme hâlâ
   * veli veya admin kararıdır. EPIC 6B/6C ile İKİ dar YAZMA izni eklendi:
   * kendi ödev teslimini yükleme ve öğretmen hakkında geri bildirim —
   * ikisi de yalnızca kendi kaydına, tool katmanında ayrıca kapsamlanır.
   */
  STUDENT: [
    "students:read",
    "tools:catalog",
    "notifications:read",
    "announcements:read",
    "assessments:read",
    "homework:read",
    "homework:submit",
    "materials:read",
    "teacher_feedback:submit",
    "curriculum:read",
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
    "curriculum:read",
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
