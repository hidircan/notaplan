import { describe, it, expect } from "vitest";
import {
  findOwnPayout,
  findOwnStudent,
  ownPayouts,
  ownStudentLessons,
  ownStudents,
  ownWeekLessons,
} from "../teacher-portal-scope";
import type { Lesson, Student, TeacherPayout } from "../types";

function makePayout(overrides: Partial<TeacherPayout> = {}): TeacherPayout {
  return {
    id: "payout1",
    teacherId: "t1",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    totalMinutes: 90,
    totalAmount: 1035,
    status: "pending",
    generatedAt: "2026-09-01T00:00:00+03:00",
    ...overrides,
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "l1",
    studentId: "s1",
    teacherId: "t1",
    roomId: "r1",
    branchId: "erzene",
    instrument: "Piyano",
    startAt: "2026-08-10T10:00:00+03:00",
    endAt: "2026-08-10T10:30:00+03:00",
    type: "regular",
    status: "completed",
    ...overrides,
  };
}

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    name: "Zeynep",
    email: "z@example.com",
    phone: "0500",
    parentName: "Selin",
    parentPhone: "0501",
    branchId: "erzene",
    instruments: ["Piyano"],
    teacherId: "t1",
    packageName: "Aylık",
    weeklyLessonCount: 1,
    monthlyFee: 1000,
    active: true,
    notes: "",
    createdAt: "2026-01-01T00:00:00+03:00",
    ...overrides,
  };
}

describe("ownPayouts", () => {
  it("yalnızca istenen teacherId'nin payout'larını döner", () => {
    const payouts = [
      makePayout({ id: "p1", teacherId: "t1" }),
      makePayout({ id: "p2", teacherId: "t2" }),
    ];
    expect(ownPayouts(payouts, "t1").map((p) => p.id)).toEqual(["p1"]);
  });

  it("hiç payout yoksa boş dizi döner", () => {
    expect(ownPayouts([], "t1")).toEqual([]);
  });
});

describe("findOwnPayout — erişim sınırlaması", () => {
  it("payout gerçekten bu öğretmene aitse döner", () => {
    const payouts = [makePayout({ id: "p1", teacherId: "t1" })];
    expect(findOwnPayout(payouts, "p1", "t1")?.id).toBe("p1");
  });

  it("payout BAŞKA bir öğretmene aitse undefined döner (kesinlikle sızdırmaz)", () => {
    const payouts = [makePayout({ id: "p1", teacherId: "t2" })];
    expect(findOwnPayout(payouts, "p1", "t1")).toBeUndefined();
  });

  it("payoutId hiç yoksa undefined döner", () => {
    const payouts = [makePayout({ id: "p1", teacherId: "t1" })];
    expect(findOwnPayout(payouts, "does-not-exist", "t1")).toBeUndefined();
  });
});

describe("ownStudents / findOwnStudent — öğrenci sahipliği", () => {
  it("ownStudents yalnızca bu öğretmenin öğrencilerini döner", () => {
    const students = [
      makeStudent({ id: "s1", teacherId: "t1" }),
      makeStudent({ id: "s2", teacherId: "t2" }),
      makeStudent({ id: "s5", teacherId: "t1" }),
    ];
    expect(ownStudents(students, "t1").map((s) => s.id)).toEqual(["s1", "s5"]);
  });

  it("findOwnStudent kendi öğrencisini döner", () => {
    const students = [makeStudent({ id: "s1", teacherId: "t1" })];
    expect(findOwnStudent(students, "s1", "t1")?.id).toBe("s1");
  });

  it("findOwnStudent başka öğretmenin öğrencisini sızdırmaz (cross-teacher)", () => {
    const students = [makeStudent({ id: "s2", teacherId: "t2" })];
    expect(findOwnStudent(students, "s2", "t1")).toBeUndefined();
  });

  it("findOwnStudent olmayan id için undefined döner", () => {
    expect(findOwnStudent([makeStudent()], "ghost", "t1")).toBeUndefined();
  });
});

describe("ownStudentLessons", () => {
  it("yalnızca bu öğretmen + bu öğrenci derslerini döner, tarih azalan", () => {
    const lessons = [
      makeLesson({ id: "l1", teacherId: "t1", studentId: "s1", startAt: "2026-08-01T10:00:00+03:00" }),
      makeLesson({ id: "l2", teacherId: "t1", studentId: "s1", startAt: "2026-08-10T10:00:00+03:00" }),
      makeLesson({ id: "l3", teacherId: "t2", studentId: "s1", startAt: "2026-08-11T10:00:00+03:00" }), // başka öğretmen
      makeLesson({ id: "l4", teacherId: "t1", studentId: "s5", startAt: "2026-08-12T10:00:00+03:00" }), // başka öğrenci
    ];
    expect(ownStudentLessons(lessons, "t1", "s1").map((l) => l.id)).toEqual(["l2", "l1"]);
  });
});

describe("ownWeekLessons", () => {
  const weekStart = "2026-08-03T00:00:00+03:00";
  const weekEnd = "2026-08-10T00:00:00+03:00";

  it("yalnızca istenen teacherId'nin ve hafta aralığındaki derslerini döner", () => {
    const lessons = [
      makeLesson({ id: "l1", teacherId: "t1", startAt: "2026-08-05T10:00:00+03:00" }),
      makeLesson({ id: "l2", teacherId: "t2", startAt: "2026-08-05T10:00:00+03:00" }), // başka öğretmen
      makeLesson({ id: "l3", teacherId: "t1", startAt: "2026-07-20T10:00:00+03:00" }), // aralık dışı
    ];
    const result = ownWeekLessons(lessons, "t1", weekStart, weekEnd);
    expect(result.map((l) => l.id)).toEqual(["l1"]);
  });

  it("weekEnd hariç (exclusive) sınırdır", () => {
    const lessons = [makeLesson({ id: "l1", teacherId: "t1", startAt: weekEnd })];
    expect(ownWeekLessons(lessons, "t1", weekStart, weekEnd)).toEqual([]);
  });

  it("sonuç saat sırasına göre sıralanır", () => {
    const lessons = [
      makeLesson({ id: "later", teacherId: "t1", startAt: "2026-08-06T16:00:00+03:00" }),
      makeLesson({ id: "earlier", teacherId: "t1", startAt: "2026-08-04T09:00:00+03:00" }),
    ];
    const result = ownWeekLessons(lessons, "t1", weekStart, weekEnd);
    expect(result.map((l) => l.id)).toEqual(["earlier", "later"]);
  });
});
