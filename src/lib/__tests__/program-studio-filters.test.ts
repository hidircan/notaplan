import { describe, it, expect } from "vitest";
import {
  filterLessonsForCalendar,
  activeTeachersForBranch,
  resolveTeacherFilterForBranch,
} from "../../components/program-studio";
import type { Lesson, Teacher } from "../types";

function lesson(overrides: Partial<Lesson>): Lesson {
  return {
    id: "l1",
    studentId: "s1",
    teacherId: "t1",
    roomId: "r1",
    branchId: "erzene",
    instrument: "Piyano",
    startAt: "2026-08-03T10:00:00+03:00",
    endAt: "2026-08-03T10:45:00+03:00",
    type: "regular",
    status: "scheduled",
    ...overrides,
  };
}

function teacher(overrides: Partial<Teacher>): Teacher {
  return {
    id: "t1",
    name: "Nilüfer Acar",
    email: "n@x.com",
    phone: "0",
    branchId: "erzene",
    instruments: ["Piyano"],
    availability: [],
    maxDailyLessons: 8,
    active: true,
    color: "#000",
    ...overrides,
  };
}

describe("filterLessonsForCalendar", () => {
  const lessons = [
    lesson({ id: "l1", branchId: "erzene", teacherId: "t1" }),
    lesson({ id: "l2", branchId: "evka3", teacherId: "t2" }),
    lesson({ id: "l3", branchId: "erzene", teacherId: "t2" }),
  ];

  it("filtre yokken tüm dersleri döner", () => {
    expect(filterLessonsForCalendar(lessons, "", "")).toHaveLength(3);
  });

  it("şube filtresi yalnızca o şubenin derslerini bırakır", () => {
    const result = filterLessonsForCalendar(lessons, "erzene", "");
    expect(result.map((l) => l.id)).toEqual(["l1", "l3"]);
  });

  it("öğretmen filtresi diğer öğretmenlerin derslerini tamamen gizler", () => {
    const result = filterLessonsForCalendar(lessons, "", "t2");
    expect(result.map((l) => l.id)).toEqual(["l2", "l3"]);
  });

  it("şube ve öğretmen filtresi birlikte çalışır", () => {
    const result = filterLessonsForCalendar(lessons, "erzene", "t2");
    expect(result.map((l) => l.id)).toEqual(["l3"]);
  });
});

describe("activeTeachersForBranch", () => {
  const teachers = [
    teacher({ id: "t1", branchId: "erzene", active: true }),
    teacher({ id: "t2", branchId: "evka3", active: true }),
    teacher({ id: "t3", branchId: "erzene", active: false }),
  ];

  it("filtre yokken tüm aktif öğretmenleri döner, pasifleri hariç tutar", () => {
    const result = activeTeachersForBranch(teachers, "");
    expect(result.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
  });

  it("şube filtresi yalnızca o şubenin aktif öğretmenlerini bırakır", () => {
    const result = activeTeachersForBranch(teachers, "erzene");
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("resolveTeacherFilterForBranch", () => {
  const teachers = [teacher({ id: "t1", branchId: "erzene" }), teacher({ id: "t2", branchId: "evka3" })];

  it("öğretmen filtresi seçili değilse boş kalır", () => {
    expect(resolveTeacherFilterForBranch(teachers, "evka3", "")).toBe("");
  });

  it("seçili öğretmen yeni şubede geçerliyse korunur", () => {
    expect(resolveTeacherFilterForBranch(teachers, "erzene", "t1")).toBe("t1");
  });

  it("seçili öğretmen yeni şubede geçersizse Tüm öğretmenlere döner", () => {
    expect(resolveTeacherFilterForBranch(teachers, "evka3", "t1")).toBe("");
  });

  it("Tüm şubeler seçilirse önceki öğretmen filtresi korunur", () => {
    expect(resolveTeacherFilterForBranch(teachers, "", "t1")).toBe("t1");
  });
});
