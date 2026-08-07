import { describe, it, expect } from "vitest";
import { ownStudentWeekLessons } from "../student-portal-scope";
import { weeklyClosedDaysForTerm } from "../attendance-calendar";
import type { Lesson } from "../types";

function makeLesson(overrides: Partial<Lesson> & Pick<Lesson, "id" | "studentId" | "startAt">): Lesson {
  return {
    teacherId: "t1",
    roomId: "r1",
    branchId: "erzene",
    instrument: "Piyano",
    endAt: overrides.startAt,
    type: "regular",
    status: "scheduled",
    ...overrides,
  };
}

describe("ÖNCELİK 4 (devam) — ownStudentWeekLessons (öğrenci portalı erişim izolasyonu)", () => {
  it("yalnızca verilen studentId'ye ait dersleri döner — başka öğrencinin dersi asla sızmaz", () => {
    const lessons: Lesson[] = [
      makeLesson({ id: "l1", studentId: "s1", startAt: "2026-08-10T10:00:00.000Z" }),
      makeLesson({ id: "l2", studentId: "s2", startAt: "2026-08-10T11:00:00.000Z" }),
      makeLesson({ id: "l3", studentId: "s1", startAt: "2026-08-11T10:00:00.000Z" }),
    ];
    const result = ownStudentWeekLessons(lessons, "s1", "2026-08-09T00:00:00.000Z", "2026-08-16T00:00:00.000Z");
    expect(result.map((l) => l.id)).toEqual(["l1", "l3"]);
    expect(result.every((l) => l.studentId === "s1")).toBe(true);
  });

  it("hafta aralığı dışındaki dersleri hariç tutar (dahil-hariç sınırları doğru)", () => {
    const lessons: Lesson[] = [
      makeLesson({ id: "before", studentId: "s1", startAt: "2026-08-08T23:59:00.000Z" }),
      makeLesson({ id: "in-range", studentId: "s1", startAt: "2026-08-09T00:00:00.000Z" }),
      makeLesson({ id: "at-end", studentId: "s1", startAt: "2026-08-16T00:00:00.000Z" }),
    ];
    const result = ownStudentWeekLessons(lessons, "s1", "2026-08-09T00:00:00.000Z", "2026-08-16T00:00:00.000Z");
    expect(result.map((l) => l.id)).toEqual(["in-range"]);
  });

  it("tarihe göre artan sırada döner", () => {
    const lessons: Lesson[] = [
      makeLesson({ id: "later", studentId: "s1", startAt: "2026-08-12T15:00:00.000Z" }),
      makeLesson({ id: "earlier", studentId: "s1", startAt: "2026-08-10T09:00:00.000Z" }),
    ];
    const result = ownStudentWeekLessons(lessons, "s1", "2026-08-09T00:00:00.000Z", "2026-08-16T00:00:00.000Z");
    expect(result.map((l) => l.id)).toEqual(["earlier", "later"]);
  });
});

describe("ÖNCELİK 4 (devam) — öğrenci portalı: döneme göre gün seti", () => {
  it("Güz: Pazartesi kapalı gün setinde, Cumartesi/Pazar açık gün setinde DEĞİL (yani kapalı değil)", () => {
    const closed = weeklyClosedDaysForTerm("guz");
    expect(closed).toEqual([1]);
    expect(closed.includes(0)).toBe(false); // Pazar açık
    expect(closed.includes(6)).toBe(false); // Cumartesi açık
  });

  it("Yaz: Cumartesi+Pazar kapalı gün setinde, Pazartesi açık gün setinde DEĞİL (yani kapalı değil)", () => {
    const closed = weeklyClosedDaysForTerm("yaz");
    expect(closed).toEqual([0, 6]);
    expect(closed.includes(1)).toBe(false); // Pazartesi açık
  });
});
