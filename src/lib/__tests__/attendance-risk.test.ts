import { describe, it, expect } from "vitest";
import { computeStudentAttendanceRisk, computeAllStudentAttendanceRisks } from "../insights/attendance-risk";
import type { AppData, Attendance, Lesson, Student } from "../types";

const BRANCH_A = "erzene";

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
    teachers: [],
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

function lessonsAndAttendances(statuses: Array<Attendance["status"]>) {
  const lessons: Lesson[] = statuses.map((_, i) =>
    makeLesson({ id: `l${i}`, startAt: `2026-08-${10 + i}T10:00:00+03:00` })
  );
  const attendances: Attendance[] = statuses.map((status, i) =>
    makeAttendance({ id: `a${i}`, lessonId: `l${i}`, status })
  );
  return { lessons, attendances };
}

describe("computeStudentAttendanceRisk", () => {
  it("yeterli işlenmiş ders yoksa 'low' döner (yetersiz veri, uydurma risk yok)", () => {
    const { lessons, attendances } = lessonsAndAttendances(["absent", "absent"]);
    const data = makeData({ lessons, attendances });
    const result = computeStudentAttendanceRisk(data, "s1");
    expect(result.riskLevel).toBe("low");
    expect(result.gradedLessonCount).toBe(2);
  });

  it("tamamı 'present' ise 'low' döner", () => {
    const { lessons, attendances } = lessonsAndAttendances(["present", "present", "present", "present"]);
    const data = makeData({ lessons, attendances });
    const result = computeStudentAttendanceRisk(data, "s1");
    expect(result.riskLevel).toBe("low");
    expect(result.consecutiveAbsences).toBe(0);
  });

  it("art arda 3 devamsızlık 'high' risk üretir", () => {
    const { lessons, attendances } = lessonsAndAttendances(["present", "absent", "absent", "absent"]);
    const data = makeData({ lessons, attendances });
    const result = computeStudentAttendanceRisk(data, "s1");
    expect(result.riskLevel).toBe("high");
    expect(result.consecutiveAbsences).toBe(3);
  });

  it("art arda 2 devamsızlık ama düşük genel oran ile 'medium' risk üretir (henüz 'high' değil)", () => {
    const { lessons, attendances } = lessonsAndAttendances([
      "present",
      "present",
      "present",
      "present",
      "present",
      "present",
      "absent",
      "absent",
    ]);
    const data = makeData({ lessons, attendances });
    const result = computeStudentAttendanceRisk(data, "s1");
    expect(result.consecutiveAbsences).toBe(2);
    expect(result.riskLevel).toBe("medium");
  });

  it("en son ders 'present' ise geçmişte devamsızlık olsa bile consecutiveAbsences sıfırlanır", () => {
    const { lessons, attendances } = lessonsAndAttendances(["absent", "absent", "absent", "present"]);
    const data = makeData({ lessons, attendances });
    const result = computeStudentAttendanceRisk(data, "s1");
    expect(result.consecutiveAbsences).toBe(0);
  });

  it("başka öğrencinin yoklaması bu öğrenciyi etkilemez (öğrenci izolasyonu)", () => {
    const { lessons, attendances } = lessonsAndAttendances(["present", "present", "present"]);
    const otherLessons = [makeLesson({ id: "lx", studentId: "s2" })];
    const otherAttendances = [makeAttendance({ id: "ax", lessonId: "lx", studentId: "s2", status: "absent" })];
    const data = makeData({
      students: [makeStudent({ id: "s1" }), makeStudent({ id: "s2" })],
      lessons: [...lessons, ...otherLessons],
      attendances: [...attendances, ...otherAttendances],
    });
    const result = computeStudentAttendanceRisk(data, "s1");
    expect(result.riskLevel).toBe("low");
    expect(result.absentCount).toBe(0);
  });

  it("computeAllStudentAttendanceRisks tüm öğrenciler için bir sonuç döner", () => {
    const data = makeData({ students: [makeStudent({ id: "s1" }), makeStudent({ id: "s2" })] });
    const results = computeAllStudentAttendanceRisks(data);
    expect(results.map((r) => r.studentId).sort()).toEqual(["s1", "s2"]);
  });
});
