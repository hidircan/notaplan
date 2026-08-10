import { describe, it, expect } from "vitest";
import { computeTeacherPerformanceScore, computeAllTeacherPerformanceScores } from "../insights/teacher-performance";
import type { AppData, Attendance, Lesson, Student, Teacher } from "../types";

const BRANCH_A = "erzene";

function makeTeacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: "t1",
    name: "Ada Öğretmen",
    email: "",
    phone: "",
    branchId: BRANCH_A,
    instruments: ["Piyano"],
    availability: [],
    maxDailyLessons: 8,
    active: true,
    color: "#7c3aed",
    ...overrides,
  };
}

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    name: "Ece Öğrenci",
    email: "",
    phone: "",
    parentName: "",
    parentPhone: "",
    branchId: BRANCH_A,
    instruments: ["Piyano"],
    teacherId: "t1",
    packageName: "",
    weeklyLessonCount: 1,
    monthlyFee: 0,
    active: true,
    notes: "",
    createdAt: "2026-01-01T00:00:00+03:00",
    ...overrides,
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "l1",
    studentId: "s1",
    teacherId: "t1",
    roomId: "r1",
    branchId: BRANCH_A,
    instrument: "Piyano",
    startAt: "2026-08-10T10:00:00+03:00",
    endAt: "2026-08-10T10:30:00+03:00",
    type: "regular",
    status: "completed",
    ...overrides,
  };
}

function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: "a1",
    lessonId: "l1",
    studentId: "s1",
    status: "present",
    markedAt: "2026-08-10T10:30:00+03:00",
    createsMakeupCredit: false,
    ...overrides,
  };
}

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    settings: {
      tenantId: "demo-tenant",
      name: "Test Okulu",
      shortName: "Test",
      city: "İzmir",
      website: "",
      email: "",
      phone: "",
      logoUrl: "",
      makeupWindowDays: 14,
      lessonDurationMinutes: 45,
      workingHours: { start: "09:00", end: "21:00" },
      workingDays: [1, 2, 3, 4, 5, 6],
      currency: "TRY",
      feeRoundingMode: "exact_minutes",
      branches: [],
    },
    teachers: [makeTeacher()],
    students: [makeStudent()],
    rooms: [],
    lessons: [],
    lessonSeries: [],
    attendances: [],
    makeupRequests: [],
    payments: [],
    teacherFeeRules: [],
    teacherPayouts: [],
    ...overrides,
  };
}

describe("computeTeacherPerformanceScore", () => {
  it("yeterli işlenmiş ders yoksa score:null döner (yetersiz veri, uydurma skor yok)", () => {
    const data = makeData({
      lessons: [makeLesson({ id: "l1" }), makeLesson({ id: "l2" })],
      attendances: [makeAttendance({ id: "a1", lessonId: "l1", status: "present" })],
    });
    const result = computeTeacherPerformanceScore(data, "t1");
    expect(result.score).toBeNull();
    expect(result.gradedLessonCount).toBe(1);
  });

  it("tamamı 'present' ise skor 100 olur", () => {
    const lessons = [makeLesson({ id: "l1" }), makeLesson({ id: "l2" }), makeLesson({ id: "l3" })];
    const attendances = lessons.map((l, i) =>
      makeAttendance({ id: `a${i}`, lessonId: l.id, status: "present" })
    );
    const data = makeData({ lessons, attendances });
    const result = computeTeacherPerformanceScore(data, "t1");
    expect(result.score).toBe(100);
    expect(result.gradedLessonCount).toBe(3);
  });

  it("okul kaynaklı iptaller skoru düşürür (öğretmen/okul kaynaklı olduğu için)", () => {
    const lessons = [makeLesson({ id: "l1" }), makeLesson({ id: "l2" }), makeLesson({ id: "l3" })];
    const attendances = [
      makeAttendance({ id: "a1", lessonId: "l1", status: "present" }),
      makeAttendance({ id: "a2", lessonId: "l2", status: "present" }),
      makeAttendance({ id: "a3", lessonId: "l3", status: "cancelled_by_school" }),
    ];
    const data = makeData({ lessons, attendances });
    const result = computeTeacherPerformanceScore(data, "t1");
    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeLessThan(100);
  });

  it("başka öğretmenin dersleri/yoklamaları skoru etkilemez (tenant/teacher izolasyonu)", () => {
    const lessons = [
      makeLesson({ id: "l1", teacherId: "t1" }),
      makeLesson({ id: "l2", teacherId: "t1" }),
      makeLesson({ id: "l3", teacherId: "t1" }),
      makeLesson({ id: "l4", teacherId: "t2" }),
    ];
    const attendances = [
      makeAttendance({ id: "a1", lessonId: "l1", status: "present" }),
      makeAttendance({ id: "a2", lessonId: "l2", status: "present" }),
      makeAttendance({ id: "a3", lessonId: "l3", status: "present" }),
      makeAttendance({ id: "a4", lessonId: "l4", status: "absent" }),
    ];
    const data = makeData({
      teachers: [makeTeacher({ id: "t1" }), makeTeacher({ id: "t2" })],
      lessons,
      attendances,
    });
    const result = computeTeacherPerformanceScore(data, "t1");
    expect(result.score).toBe(100);
    expect(result.gradedLessonCount).toBe(3);
  });

  it("hiç ders/öğrenci yoksa fırlatmaz, score:null ve sayaçlar 0 döner", () => {
    const data = makeData({ lessons: [], attendances: [], students: [] });
    const result = computeTeacherPerformanceScore(data, "t1");
    expect(result.score).toBeNull();
    expect(result.activeStudentCount).toBe(0);
  });

  it("computeAllTeacherPerformanceScores tüm öğretmenler için bir sonuç döner", () => {
    const data = makeData({ teachers: [makeTeacher({ id: "t1" }), makeTeacher({ id: "t2" })] });
    const results = computeAllTeacherPerformanceScores(data);
    expect(results.map((r) => r.teacherId).sort()).toEqual(["t1", "t2"]);
  });
});
