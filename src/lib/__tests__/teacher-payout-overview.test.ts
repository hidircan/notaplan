import { describe, it, expect } from "vitest";
import { computeTeacherPayoutOverview } from "../teacher-payout-overview";
import type { AppData, Lesson, Student, Teacher, TeacherFeeRule } from "../types";

const BRANCH_A = "erzene";

function makeTeacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: "t1",
    name: "Ada Öğretmen",
    email: "ada@example.com",
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

function makeFeeRule(overrides: Partial<TeacherFeeRule> = {}): TeacherFeeRule {
  return {
    id: "fee1",
    teacherId: "t1",
    perMinuteRate: 11.5,
    effectiveFrom: "2020-01-01",
    createdAt: "2020-01-01T00:00:00+03:00",
    ...overrides,
  };
}

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    settings: {
      tenantId: "tenant_test",
      name: "Test Müzik Akademisi",
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
      branches: [{ id: BRANCH_A, name: "Erzene Şubesi", shortName: "Erzene", address: "", phone: "", city: "İzmir" }],
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

const PERIOD_START = "2026-08-01";
const PERIOD_END = "2026-08-31";

describe("computeTeacherPayoutOverview", () => {
  it("payout kaydı yoksa canlı hesaplanan tutar bekleyen toplama girer", () => {
    const data = makeData({
      lessons: [makeLesson({ startAt: "2026-08-10T10:00:00+03:00", endAt: "2026-08-10T10:30:00+03:00" })],
      teacherFeeRules: [makeFeeRule()],
    });
    const result = computeTeacherPayoutOverview(data, PERIOD_START, PERIOD_END);
    expect(result.pendingTotal).toBe(345.0);
    expect(result.paidTotal).toBe(0);
    expect(result.missingFeeRuleLessonCount).toBe(0);
  });

  it("eksik ücret kurallı tamamlanmış ders varsa sayıya girer, tutara girmez", () => {
    const data = makeData({
      lessons: [makeLesson()],
      teacherFeeRules: [], // kural yok
    });
    const result = computeTeacherPayoutOverview(data, PERIOD_START, PERIOD_END);
    expect(result.pendingTotal).toBe(0);
    expect(result.missingFeeRuleLessonCount).toBe(1);
  });

  it("dönem için PENDING payout snapshot'ı varsa donmuş tutarı kullanır, canlı hesaplamaz", () => {
    const data = makeData({
      lessons: [makeLesson()],
      teacherFeeRules: [makeFeeRule({ perMinuteRate: 99 })], // kural değişmiş olsa bile
      teacherPayouts: [
        {
          id: "payout1",
          teacherId: "t1",
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          totalMinutes: 30,
          totalAmount: 345.0, // eski oranla donmuş snapshot
          status: "pending",
          generatedAt: "2026-09-01T00:00:00+03:00",
        },
      ],
    });
    const result = computeTeacherPayoutOverview(data, PERIOD_START, PERIOD_END);
    expect(result.pendingTotal).toBe(345.0);
    expect(result.missingFeeRuleLessonCount).toBe(0); // payout zaten var, tekrar taranmaz
  });

  it("dönem için PAID payout varsa (paidAt dönem içinde) ödenen toplama girer, bekleyene girmez", () => {
    const data = makeData({
      teacherPayouts: [
        {
          id: "payout1",
          teacherId: "t1",
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          totalMinutes: 30,
          totalAmount: 345.0,
          status: "paid",
          paidAt: "2026-08-15T00:00:00+03:00",
          method: "Havale",
          generatedAt: "2026-08-01T00:00:00+03:00",
        },
      ],
    });
    const result = computeTeacherPayoutOverview(data, PERIOD_START, PERIOD_END);
    expect(result.paidTotal).toBe(345.0);
    expect(result.pendingTotal).toBe(0);
  });

  it("paidAt dönem dışındaysa ödenen toplama girmez", () => {
    const data = makeData({
      teacherPayouts: [
        {
          id: "payout1",
          teacherId: "t1",
          periodStart: "2026-07-01",
          periodEnd: "2026-07-31",
          totalMinutes: 30,
          totalAmount: 345.0,
          status: "paid",
          paidAt: "2026-07-20T00:00:00+03:00", // Ağustos dönemi dışında ödendi
          generatedAt: "2026-07-01T00:00:00+03:00",
        },
      ],
    });
    const result = computeTeacherPayoutOverview(data, PERIOD_START, PERIOD_END);
    expect(result.paidTotal).toBe(0);
  });

  it("birden fazla öğretmen için toplamlar doğru birikir", () => {
    const data = makeData({
      teachers: [makeTeacher({ id: "t1" }), makeTeacher({ id: "t2" })],
      lessons: [
        makeLesson({ id: "l1", teacherId: "t1" }),
        makeLesson({ id: "l2", teacherId: "t2", startAt: "2026-08-12T10:00:00+03:00", endAt: "2026-08-12T10:40:00+03:00" }),
      ],
      teacherFeeRules: [makeFeeRule({ id: "fee1", teacherId: "t1" }), makeFeeRule({ id: "fee2", teacherId: "t2" })],
    });
    const result = computeTeacherPayoutOverview(data, PERIOD_START, PERIOD_END);
    // t1: 30 dk * 11.5 = 345, t2: 40 dk * 11.5 = 460 → toplam 805
    expect(result.pendingTotal).toBe(805.0);
  });
});
