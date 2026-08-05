import { describe, it, expect } from "vitest";
import {
  assertStudentAccess,
  canAccessStudent,
  canAccessTeacher,
  requireRole,
} from "../services/context";
import type { ServiceContext } from "../services/context";
import type { AppRole } from "../auth/types";

/**
 * EPIC 0 + production hardening — rol/yetki matrisi.
 * TEACHER için öğrenci erişimi ownership olmadan fail-closed.
 */

function ctx(overrides: Partial<ServiceContext> & { role: AppRole }): ServiceContext {
  return { userId: "u1", tenantId: "tenant_a", channel: "web", ...overrides };
}

describe("canAccessStudent — rol matrisi", () => {
  it("SUPER_ADMIN/SCHOOL_ADMIN/AI_AGENT her öğrenciye erişir", () => {
    for (const role of ["SUPER_ADMIN", "SCHOOL_ADMIN", "AI_AGENT"] as const) {
      expect(canAccessStudent(ctx({ role }), "s1")).toBe(true);
      expect(canAccessStudent(ctx({ role }), "s_baska_kurum")).toBe(true);
    }
  });

  it("PARENT yalnızca KENDİ çocuğuna erişir — başka bir öğrenciye kesinlikle erişemez", () => {
    const parent = ctx({ role: "PARENT", studentId: "s1" });
    expect(canAccessStudent(parent, "s1")).toBe(true);
    expect(canAccessStudent(parent, "s2")).toBe(false);
    expect(canAccessStudent(parent, "s_baska_kurum")).toBe(false);
  });

  it("studentId'si olmayan PARENT hiçbir öğrenciye erişemez", () => {
    const parent = ctx({ role: "PARENT" });
    expect(canAccessStudent(parent, "s1")).toBe(false);
  });

  it("TEACHER ownership olmadan false (fail-closed IDOR koruması)", () => {
    expect(canAccessStudent(ctx({ role: "TEACHER", teacherId: "t2" }), "s1")).toBe(false);
  });

  it("TEACHER yalnızca kendi öğrencisine ownership ile erişir", () => {
    const teacher = ctx({ role: "TEACHER", teacherId: "t1" });
    expect(canAccessStudent(teacher, "s1", { teacherId: "t1" })).toBe(true);
    expect(canAccessStudent(teacher, "s2", { teacherId: "t2" })).toBe(false);
  });

  it("TEACHER teacherId yoksa erişemez", () => {
    expect(canAccessStudent(ctx({ role: "TEACHER" }), "s1", { teacherId: "t1" })).toBe(false);
  });
});

describe("assertStudentAccess", () => {
  const s1 = { id: "s1", teacherId: "t1" };

  it("kendi öğretmeni için ok", () => {
    expect(assertStudentAccess(ctx({ role: "TEACHER", teacherId: "t1" }), s1, "s1").ok).toBe(true);
  });

  it("cross-teacher FORBIDDEN", () => {
    const r = assertStudentAccess(ctx({ role: "TEACHER", teacherId: "t2" }), s1, "s1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FORBIDDEN");
  });

  it("olmayan öğrenci NOT_FOUND (bilgi sızdırmaz — aynı kabuk)", () => {
    const r = assertStudentAccess(ctx({ role: "TEACHER", teacherId: "t1" }), undefined, "ghost");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_FOUND");
  });

  it("PARENT kendi çocuğuna erişir", () => {
    expect(assertStudentAccess(ctx({ role: "PARENT", studentId: "s1" }), s1, "s1").ok).toBe(true);
  });

  it("PARENT başka çocuğa erişemez", () => {
    const r = assertStudentAccess(ctx({ role: "PARENT", studentId: "s2" }), s1, "s1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FORBIDDEN");
  });
});

describe("canAccessTeacher — rol matrisi", () => {
  it("SUPER_ADMIN/SCHOOL_ADMIN/AI_AGENT her öğretmene erişir", () => {
    for (const role of ["SUPER_ADMIN", "SCHOOL_ADMIN", "AI_AGENT"] as const) {
      expect(canAccessTeacher(ctx({ role }), "t2")).toBe(true);
    }
  });

  it("TEACHER yalnızca KENDİ kaydına erişir — başka bir öğretmene kesinlikle erişemez", () => {
    const teacher = ctx({ role: "TEACHER", teacherId: "t2" });
    expect(canAccessTeacher(teacher, "t2")).toBe(true);
    expect(canAccessTeacher(teacher, "t3")).toBe(false);
  });

  it("PARENT hiçbir öğretmen kaydına erişemez", () => {
    expect(canAccessTeacher(ctx({ role: "PARENT", studentId: "s1" }), "t2")).toBe(false);
  });
});

describe("requireRole — SUPER_ADMIN bypass, diğer roller listeye tabi", () => {
  it("SUPER_ADMIN izin listesinde olmasa bile geçer (kasıtlı bypass)", () => {
    expect(requireRole(ctx({ role: "SUPER_ADMIN" }), ["TEACHER"]).ok).toBe(true);
  });

  it("izin listesindeki rol geçer", () => {
    expect(requireRole(ctx({ role: "SCHOOL_ADMIN" }), ["SCHOOL_ADMIN", "SUPER_ADMIN"]).ok).toBe(true);
  });

  it("izin listesinde olmayan rol (SUPER_ADMIN hariç) reddedilir", () => {
    const result = requireRole(ctx({ role: "PARENT" }), ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
    expect(result.ok).toBe(false);
  });

  it("TEACHER, yalnızca ADMIN grubuna açık bir işlemi (ör. ücret değiştirme) yapamaz", () => {
    expect(requireRole(ctx({ role: "TEACHER" }), ["SCHOOL_ADMIN", "SUPER_ADMIN"]).ok).toBe(false);
  });

  it("PARENT, yalnızca STAFF grubuna açık bir işlemi (ör. yoklama işaretleme) yapamaz", () => {
    expect(
      requireRole(ctx({ role: "PARENT" }), ["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "AI_AGENT"]).ok
    ).toBe(false);
  });
});
