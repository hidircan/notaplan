import { describe, it, expect } from "vitest";
import { canAccessStudent, canAccessTeacher, requireRole } from "../services/context";
import type { ServiceContext } from "../services/context";
import type { AppRole } from "../auth/types";

/**
 * EPIC 0 (IMPLEMENTATION_PLAN.md §1) — locks in the rol/yetki matrisi as an
 * executable test, across every role, not just the couple of cases other
 * test files happen to exercise. If this matrix ever needs to change,
 * IMPLEMENTATION_PLAN.md §1 must change with it.
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

  it("TEACHER true döner (filtreleme öğrenci-şeması tool'larında ayrıca yapılır — bkz. getStudentScheduleTool)", () => {
    expect(canAccessStudent(ctx({ role: "TEACHER", teacherId: "t2" }), "s1")).toBe(true);
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
    expect(requireRole(ctx({ role: "PARENT" }), ["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "AI_AGENT"]).ok).toBe(
      false
    );
  });
});
