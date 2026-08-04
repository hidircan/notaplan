import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import { logger } from "./logger";
import { createSeedData } from "./seed";
import type {
  AppData,
  AttendanceStatus,
  BranchId,
  FeeRoundingMode,
  Instrument,
  LessonSeriesStatus,
  MakeupSlot,
  Room,
  Student,
  Teacher,
  TeacherFeeRule,
} from "./types";
import { suggestMakeupSlots, confirmMakeupSlot, validateLessonSlot } from "./makeup-engine";
import { applyLessonScheduleUpdate, applyLessonCancel } from "./lesson-update";
import {
  createLessonSeriesData,
  cancelSeriesFromLesson,
  cancelEntireSeries,
  type SeriesParams,
  type CreateSeriesResult,
  type SeriesCancelResult,
} from "./lesson-series";
import {
  createTeacherFeeRuleData,
  updateTeacherFeeRuleData,
  createTeacherPayoutSnapshot,
  markTeacherPayoutPaidData,
  type FeeRuleInput,
  type FeeRuleMutationResult,
  type CreateTeacherPayoutResult,
  type MarkPayoutPaidResult,
} from "./teacher-payout";
import type { BranchImportRow } from "./import/branches";
import type { TeacherImportRow } from "./import/teachers";
import type { RoomImportRow } from "./import/rooms";
import type { StudentImportRow } from "./import/students";
import type { ImportCommitResult } from "./import/commit-result";
import { addDays } from "date-fns";
import { requireTenantId, tryTenantId } from "./tenant-context";
import { DEFAULT_TENANT_ID } from "./auth/config";
import { getBootstrapUsersForSeed } from "./auth/users";
import { uid } from "./utils";

function tenantId(): string {
  return tryTenantId() ?? DEFAULT_TENANT_ID;
}

type PrismaSchoolWithRelations = Prisma.SchoolGetPayload<{
  include: {
    branches: true;
    teachers: true;
    students: true;
    rooms: true;
    lessons: true;
    lessonSeries: true;
    attendances: true;
    makeupRequests: true;
    payments: true;
    teacherFeeRules: true;
    teacherPayouts: true;
  };
}>;

function mapSchoolToAppData(school: PrismaSchoolWithRelations): AppData {
  return {
    settings: {
      tenantId: school.tenantId,
      name: school.name,
      shortName: school.shortName,
      city: school.city,
      website: school.website,
      email: school.email,
      phone: school.phone,
      logoUrl: school.logoUrl,
      makeupWindowDays: school.makeupWindowDays,
      lessonDurationMinutes: school.lessonDurationMinutes,
      workingHours: {
        start: school.workingHoursStart,
        end: school.workingHoursEnd,
      },
      workingDays: school.workingDays as number[],
      currency: school.currency,
      feeRoundingMode: school.feeRoundingMode as FeeRoundingMode,
      branches: school.branches.map((branch) => ({
        id: branch.id as BranchId,
        name: branch.name,
        shortName: branch.shortName,
        address: branch.address,
        phone: branch.phone,
        city: branch.city,
      })),
    },
    teachers: school.teachers.map((teacher) => ({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      branchId: teacher.branchId as BranchId,
      instruments: teacher.instruments as Instrument[],
      availability: teacher.availability as Teacher["availability"],
      maxDailyLessons: teacher.maxDailyLessons,
      active: teacher.active,
      color: teacher.color,
    })),
    students: school.students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      branchId: student.branchId as BranchId,
      instruments: student.instruments as Instrument[],
      teacherId: student.teacherId,
      packageName: student.packageName,
      weeklyLessonCount: student.weeklyLessonCount,
      monthlyFee: student.monthlyFee,
      active: student.active,
      notes: student.notes,
      createdAt: student.createdAt.toISOString(),
    })),
    rooms: school.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      branchId: room.branchId as BranchId,
      capacity: room.capacity,
      instruments: room.instruments as Instrument[],
    })),
    lessons: school.lessons.map((lesson) => ({
      id: lesson.id,
      studentId: lesson.studentId,
      teacherId: lesson.teacherId,
      roomId: lesson.roomId,
      branchId: lesson.branchId as BranchId,
      instrument: lesson.instrument as Instrument,
      startAt: lesson.startAt.toISOString(),
      endAt: lesson.endAt.toISOString(),
      type: lesson.type as import("./types").LessonType,
      status: lesson.status as "scheduled" | "completed" | "cancelled" | "no_show",
      makeupRequestId: lesson.makeupRequestId ?? undefined,
      seriesId: lesson.seriesId ?? undefined,
      notes: lesson.notes ?? undefined,
    })),
    lessonSeries: school.lessonSeries.map((series) => ({
      id: series.id,
      studentId: series.studentId,
      teacherId: series.teacherId,
      roomId: series.roomId,
      branchId: series.branchId as BranchId,
      instrument: series.instrument as Instrument,
      weekday: series.weekday,
      startTime: series.startTime,
      durationMinutes: series.durationMinutes,
      startsOn: series.startsOn.toISOString(),
      endsOn: series.endsOn.toISOString(),
      status: series.status as LessonSeriesStatus,
      createdAt: series.createdAt.toISOString(),
      updatedAt: series.updatedAt.toISOString(),
    })),
    attendances: school.attendances.map((attendance) => ({
      id: attendance.id,
      lessonId: attendance.lessonId,
      studentId: attendance.studentId,
      status: attendance.status as import("./types").AttendanceStatus,
      reason: attendance.reason ?? undefined,
      markedAt: attendance.markedAt.toISOString(),
      createsMakeupCredit: attendance.createsMakeupCredit,
    })),
    makeupRequests: school.makeupRequests.map((request) => ({
      id: request.id,
      studentId: request.studentId,
      teacherId: request.teacherId,
      branchId: request.branchId as BranchId,
      instrument: request.instrument as Instrument,
      sourceLessonId: request.sourceLessonId,
      attendanceId: request.attendanceId,
      status: request.status as import("./types").MakeupStatus,
      reason: request.reason,
      expiresAt: request.expiresAt.toISOString(),
      suggestedSlots: JSON.parse(JSON.stringify(request.suggestedSlots)) as MakeupSlot[],
      confirmedLessonId: request.confirmedLessonId ?? undefined,
      createdAt: request.createdAt.toISOString(),
      policyNote: request.policyNote,
    })),
    payments: school.payments.map((payment) => ({
      id: payment.id,
      studentId: payment.studentId,
      amount: payment.amount,
      paidAmount: payment.paidAmount,
      status: payment.status as import("./types").PaymentStatus,
      dueDate: payment.dueDate.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? undefined,
      description: payment.description,
      method: payment.method ?? undefined,
    })),
    teacherFeeRules: school.teacherFeeRules.map((rule) => ({
      id: rule.id,
      teacherId: rule.teacherId,
      branchId: (rule.branchId as BranchId) ?? undefined,
      instrument: (rule.instrument as Instrument) ?? undefined,
      perMinuteRate: rule.perMinuteRate,
      effectiveFrom: rule.effectiveFrom.toISOString(),
      effectiveTo: rule.effectiveTo?.toISOString() ?? undefined,
      createdAt: rule.createdAt.toISOString(),
    })),
    teacherPayouts: school.teacherPayouts.map((payout) => ({
      id: payout.id,
      teacherId: payout.teacherId,
      periodStart: payout.periodStart.toISOString(),
      periodEnd: payout.periodEnd.toISOString(),
      totalMinutes: payout.totalMinutes,
      totalAmount: payout.totalAmount,
      status: payout.status as "pending" | "paid",
      paidAt: payout.paidAt?.toISOString() ?? undefined,
      method: payout.method ?? undefined,
      generatedAt: payout.generatedAt.toISOString(),
    })),
  };
}

export function getDashboardStats(data: AppData) {
  const pendingMakeup = data.makeupRequests.filter(
    (m) => m.status === "pending" || m.status === "suggested"
  ).length;
  const confirmedMakeup = data.makeupRequests.filter((m) => m.status === "confirmed").length;
  const overduePayments = data.payments.filter((p) => p.status === "overdue" || p.status === "partial");
  const revenuePaid = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.paidAmount, 0);
  const revenueDue = data.payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayLessons = data.lessons.filter((l) => l.startAt.startsWith(today));
  const activeStudents = data.students.filter((s) => s.active).length;
  const activeTeachers = data.teachers.filter((t) => t.active).length;

  return {
    pendingMakeup,
    confirmedMakeup,
    overdueCount: overduePayments.length,
    revenuePaid,
    revenueDue,
    todayLessonCount: todayLessons.length,
    activeStudents,
    activeTeachers,
  };
}

async function seedDatabase(seed: AppData) {
  const tid = seed.settings.tenantId || tenantId();

  await prisma.$transaction([
    prisma.user.deleteMany({ where: { tenantId: tid } }),
    prisma.teacherPayout.deleteMany({ where: { tenantId: tid } }),
    prisma.teacherFeeRule.deleteMany({ where: { tenantId: tid } }),
    prisma.attendance.deleteMany({ where: { tenantId: tid } }),
    prisma.makeupRequest.deleteMany({ where: { tenantId: tid } }),
    prisma.payment.deleteMany({ where: { tenantId: tid } }),
    prisma.lesson.deleteMany({ where: { tenantId: tid } }),
    prisma.lessonSeries.deleteMany({ where: { tenantId: tid } }),
    prisma.student.deleteMany({ where: { tenantId: tid } }),
    prisma.teacher.deleteMany({ where: { tenantId: tid } }),
    prisma.room.deleteMany({ where: { tenantId: tid } }),
    prisma.branch.deleteMany({ where: { tenantId: tid } }),
    prisma.school.deleteMany({ where: { tenantId: tid } }),
  ]);

  await prisma.tenant.upsert({
    where: { id: tid },
    create: {
      id: tid,
      name: seed.settings.name,
      slug: tid,
      active: true,
    },
    update: { name: seed.settings.name, active: true },
  });

  const school = await prisma.school.create({
    data: {
      tenantId: tid,
      name: seed.settings.name,
      shortName: seed.settings.shortName,
      city: seed.settings.city,
      website: seed.settings.website,
      email: seed.settings.email,
      phone: seed.settings.phone,
      logoUrl: seed.settings.logoUrl,
      makeupWindowDays: seed.settings.makeupWindowDays,
      lessonDurationMinutes: seed.settings.lessonDurationMinutes,
      workingHoursStart: seed.settings.workingHours.start,
      workingHoursEnd: seed.settings.workingHours.end,
      workingDays: seed.settings.workingDays,
      currency: seed.settings.currency,
      feeRoundingMode: seed.settings.feeRoundingMode,
      branches: {
        create: seed.settings.branches.map((branch) => ({
          id: branch.id,
          tenantId: tid,
          name: branch.name,
          shortName: branch.shortName,
          address: branch.address,
          phone: branch.phone,
          city: branch.city,
        })),
      },
    },
  });

  await Promise.all(
    seed.teachers.map((teacher) =>
      prisma.teacher.create({
        data: {
          id: teacher.id,
          tenantId: tid,
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          branchId: teacher.branchId,
          schoolId: school.id,
          instruments: teacher.instruments,
          availability: teacher.availability,
          maxDailyLessons: teacher.maxDailyLessons,
          active: teacher.active,
          color: teacher.color,
        },
      })
    )
  );

  await Promise.all(
    seed.rooms.map((room) =>
      prisma.room.create({
        data: {
          id: room.id,
          tenantId: tid,
          name: room.name,
          branchId: room.branchId,
          schoolId: school.id,
          capacity: room.capacity,
          instruments: room.instruments,
        },
      })
    )
  );

  await Promise.all(
    seed.students.map((student) =>
      prisma.student.create({
        data: {
          id: student.id,
          tenantId: tid,
          name: student.name,
          email: student.email,
          phone: student.phone,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          branchId: student.branchId,
          schoolId: school.id,
          instruments: student.instruments,
          teacherId: student.teacherId,
          packageName: student.packageName,
          weeklyLessonCount: student.weeklyLessonCount,
          monthlyFee: student.monthlyFee,
          active: student.active,
          notes: student.notes,
          createdAt: new Date(student.createdAt),
        },
      })
    )
  );

  await Promise.all(
    seed.lessons.map((lesson) =>
      prisma.lesson.create({
        data: {
          id: lesson.id,
          tenantId: tid,
          studentId: lesson.studentId,
          teacherId: lesson.teacherId,
          roomId: lesson.roomId,
          branchId: lesson.branchId,
          schoolId: school.id,
          instrument: lesson.instrument,
          startAt: new Date(lesson.startAt),
          endAt: new Date(lesson.endAt),
          type: lesson.type,
          status: lesson.status,
          makeupRequestId: lesson.makeupRequestId,
          notes: lesson.notes,
        },
      })
    )
  );

  await Promise.all(
    seed.attendances.map((attendance) =>
      prisma.attendance.create({
        data: {
          id: attendance.id,
          tenantId: tid,
          lessonId: attendance.lessonId,
          studentId: attendance.studentId,
          schoolId: school.id,
          status: attendance.status,
          reason: attendance.reason,
          markedAt: new Date(attendance.markedAt),
          createsMakeupCredit: attendance.createsMakeupCredit,
        },
      })
    )
  );

  await Promise.all(
    seed.payments.map((payment) =>
      prisma.payment.create({
        data: {
          id: payment.id,
          tenantId: tid,
          studentId: payment.studentId,
          schoolId: school.id,
          amount: payment.amount,
          paidAmount: payment.paidAmount,
          status: payment.status,
          dueDate: new Date(payment.dueDate),
          paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined,
          description: payment.description,
          method: payment.method,
        },
      })
    )
  );

  await Promise.all(
    seed.makeupRequests.map((request) =>
      prisma.makeupRequest.create({
        data: {
          id: request.id,
          tenantId: tid,
          studentId: request.studentId,
          teacherId: request.teacherId,
          branchId: request.branchId,
          schoolId: school.id,
          instrument: request.instrument,
          sourceLessonId: request.sourceLessonId,
          attendanceId: request.attendanceId,
          status: request.status,
          reason: request.reason,
          expiresAt: new Date(request.expiresAt),
          suggestedSlots: JSON.parse(JSON.stringify(request.suggestedSlots)) as Prisma.JsonArray,
          confirmedLessonId: request.confirmedLessonId,
          createdAt: new Date(request.createdAt),
          policyNote: request.policyNote,
        },
      })
    )
  );

  await Promise.all(
    seed.teacherFeeRules.map((rule) =>
      prisma.teacherFeeRule.create({
        data: {
          id: rule.id,
          tenantId: tid,
          teacherId: rule.teacherId,
          schoolId: school.id,
          branchId: rule.branchId,
          instrument: rule.instrument,
          perMinuteRate: rule.perMinuteRate,
          effectiveFrom: new Date(rule.effectiveFrom),
          effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo) : undefined,
          createdAt: new Date(rule.createdAt),
        },
      })
    )
  );

  await Promise.all(
    seed.teacherPayouts.map((payout) =>
      prisma.teacherPayout.create({
        data: {
          id: payout.id,
          tenantId: tid,
          teacherId: payout.teacherId,
          schoolId: school.id,
          periodStart: new Date(payout.periodStart),
          periodEnd: new Date(payout.periodEnd),
          totalMinutes: payout.totalMinutes,
          totalAmount: payout.totalAmount,
          status: payout.status,
          paidAt: payout.paidAt ? new Date(payout.paidAt) : undefined,
          method: payout.method,
          generatedAt: new Date(payout.generatedAt),
        },
      })
    )
  );

  // Auth users for this tenant (bcrypt hashed)
  await prisma.user.createMany({
    data: getBootstrapUsersForSeed(tid).map((u) => ({
      ...u,
      email: u.email.toLowerCase(),
    })),
  });

  return school;
}

const schoolInclude = {
  branches: true,
  teachers: true,
  students: true,
  rooms: true,
  lessons: true,
  lessonSeries: true,
  attendances: true,
  makeupRequests: true,
  payments: true,
  teacherFeeRules: true,
  teacherPayouts: true,
} as const;

export async function readData(): Promise<AppData> {
  const tid = tenantId();
  const school = await prisma.school.findFirst({
    where: { tenantId: tid },
    include: schoolInclude,
  });

  if (!school) {
    logger.info("readData", "no school for tenant, seeding", tid);
    const seed = createSeedData();
    seed.settings.tenantId = tid;
    await seedDatabase(seed);
    const seededSchool = await prisma.school.findFirst({
      where: { tenantId: tid },
      include: schoolInclude,
    });
    if (!seededSchool) throw new Error("Okul verisi bulunamadı");
    return mapSchoolToAppData(seededSchool);
  }

  return mapSchoolToAppData(school);
}

export async function resetData(): Promise<AppData> {
  logger.info("resetData", "resetting tenant demo data");
  const seed = createSeedData();
  seed.settings.tenantId = tenantId();
  await seedDatabase(seed);
  return readData();
}

export async function markAttendance(input: {
  lessonId: string;
  status: AttendanceStatus;
  reason?: string;
}): Promise<AppData> {
  logger.info("markAttendance", input.lessonId, input.status);

  const tid = requireTenantId();
  const lesson = await prisma.lesson.findFirst({
    where: { id: input.lessonId, tenantId: tid },
  });
  if (!lesson) throw new Error("Ders bulunamadı");

  const createsMakeupCredit =
    input.status === "absent" || input.status === "cancelled_by_school";

  const lessonStatus =
    input.status === "present" || input.status === "late"
      ? "completed"
      : input.status === "absent"
      ? "no_show"
      : input.status === "cancelled_by_school"
      ? "cancelled"
      : lesson.status;

  await prisma.lesson.updateMany({
    where: { id: input.lessonId, tenantId: tid },
    data: { status: lessonStatus },
  });

  let attendanceId: string;
  const existingAttendance = await prisma.attendance.findFirst({
    where: { lessonId: input.lessonId, tenantId: tid },
  });

  if (existingAttendance) {
    const updated = await prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        status: input.status,
        reason: input.reason,
        markedAt: new Date(),
        createsMakeupCredit,
      },
    });
    attendanceId = updated.id;
  } else {
    const created = await prisma.attendance.create({
      data: {
        tenantId: tid,
        lessonId: input.lessonId,
        studentId: lesson.studentId,
        schoolId: lesson.schoolId,
        status: input.status,
        reason: input.reason,
        markedAt: new Date(),
        createsMakeupCredit,
      },
    });
    attendanceId = created.id;
  }
  await prisma.makeupRequest.deleteMany({
    where: { sourceLessonId: input.lessonId, tenantId: tid },
  });

  if (createsMakeupCredit) {
    const branch = await prisma.branch.findFirst({
      where: { id: lesson.branchId, tenantId: tid },
    });
    const school = await prisma.school.findFirst({
      where: { id: lesson.schoolId, tenantId: tid },
    });
    const policyNote =
      input.status === "cancelled_by_school"
        ? `Okul kaynaklı iptal — öncelikli yerleştirme · ${branch?.shortName ?? ""}`
        : `${school?.makeupWindowDays ?? 0} gün içinde · aynı öğretmen · ${branch?.shortName ?? ""}`;

    await prisma.makeupRequest.create({
      data: {
        tenantId: tid,
        studentId: lesson.studentId,
        teacherId: lesson.teacherId,
        branchId: lesson.branchId,
        schoolId: lesson.schoolId,
        instrument: lesson.instrument,
        sourceLessonId: lesson.id,
        attendanceId,
        status: "pending",
        reason:
          input.reason || (input.status === "cancelled_by_school" ? "Okul iptali" : "Devamsızlık"),
        expiresAt: addDays(new Date(), school?.makeupWindowDays ?? 0),
        suggestedSlots: [],
        createdAt: new Date(),
        policyNote,
      },
    });
  }

  return readData();
}

export async function generateSuggestions(
  requestId: string,
  options?: { maxSlots?: number }
): Promise<AppData> {
  logger.info("generateSuggestions", requestId);
  const tid = requireTenantId();
  const data = await readData();
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");

  const slots = suggestMakeupSlots(data, request, options);
  const slotsJson = JSON.parse(JSON.stringify(slots)) as Prisma.JsonArray;
  const existing = await prisma.makeupRequest.findFirst({
    where: { id: requestId, tenantId: tid },
  });
  if (!existing) throw new Error("Telafi talebi bulunamadı");
  await prisma.makeupRequest.update({
    where: { id: existing.id },
    data: { status: "suggested", suggestedSlots: slotsJson },
  });
  return readData();
}

export async function confirmSlot(requestId: string, slot: MakeupSlot): Promise<AppData> {
  logger.info("confirmSlot", requestId, slot.startAt, slot.teacherId, slot.roomId);
  const tid = requireTenantId();
  const data = await readData();
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");

  const { lessonId, slot: validatedSlot } = confirmMakeupSlot(data, requestId, slot);

  const branch = await prisma.branch.findFirst({
    where: { id: request.branchId, tenantId: tid },
  });
  if (!branch) throw new Error("Şube bulunamadı");

  await prisma.lesson.create({
    data: {
      id: lessonId,
      tenantId: tid,
      studentId: request.studentId,
      teacherId: validatedSlot.teacherId,
      roomId: validatedSlot.roomId,
      branchId: validatedSlot.branchId,
      schoolId: branch.schoolId,
      instrument: request.instrument,
      startAt: new Date(validatedSlot.startAt),
      endAt: new Date(validatedSlot.endAt),
      type: "makeup",
      status: "scheduled",
      makeupRequestId: requestId,
      notes: `Telafi · kaynak ders ${request.sourceLessonId}`,
    },
  });

  await prisma.makeupRequest.updateMany({
    where: { id: requestId, tenantId: tid },
    data: { status: "confirmed", confirmedLessonId: lessonId },
  });

  return readData();
}

export async function cancelMakeup(requestId: string): Promise<AppData> {
  logger.info("cancelMakeup", requestId);
  const tid = requireTenantId();
  const updated = await prisma.makeupRequest.updateMany({
    where: { id: requestId, tenantId: tid },
    data: { status: "cancelled" },
  });
  if (updated.count === 0) throw new Error("Telafi talebi bulunamadı");
  return readData();
}

export async function addStudent(
  student: Omit<Student, "id" | "createdAt" | "active">
): Promise<AppData> {
  logger.info("addStudent", student.name);
  const tid = requireTenantId();
  const branch = await prisma.branch.findFirst({
    where: { id: student.branchId, tenantId: tid },
  });
  if (!branch) throw new Error("Şube bulunamadı");
  await prisma.student.create({
    data: {
      ...student,
      id: `stu_${Date.now().toString(36)}`,
      tenantId: tid,
      schoolId: branch.schoolId,
      active: true,
      createdAt: new Date(),
      instruments: student.instruments,
    },
  });
  return readData();
}

export async function addTeacher(
  teacher: Omit<Teacher, "id" | "active" | "color">
): Promise<AppData> {
  logger.info("addTeacher", teacher.name);
  const tid = requireTenantId();
  const branch = await prisma.branch.findFirst({
    where: { id: teacher.branchId, tenantId: tid },
  });
  if (!branch) throw new Error("Şube bulunamadı");
  const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#059669", "#4f46e5"];
  await prisma.teacher.create({
    data: {
      ...teacher,
      id: `tch_${Date.now().toString(36)}`,
      tenantId: tid,
      schoolId: branch.schoolId,
      active: true,
      color: colors[Math.floor(Math.random() * colors.length)],
      instruments: teacher.instruments,
      availability: teacher.availability,
    },
  });
  return readData();
}

export async function markPaymentPaid(paymentId: string): Promise<AppData> {
  logger.info("markPaymentPaid", paymentId);
  const tid = requireTenantId();
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId: tid },
  });
  if (!payment) throw new Error("Ödeme bulunamadı");

  await prisma.payment.updateMany({
    where: { id: paymentId, tenantId: tid },
    data: {
      status: "paid",
      paidAmount: payment.amount,
      paidAt: new Date(),
    },
  });

  return readData();
}

export async function addBranch(branch: {
  name: string;
  shortName: string;
  address: string;
  phone: string;
  city: string;
}): Promise<AppData> {
  logger.info("addBranch", branch.name);
  const tid = requireTenantId();
  const school = await prisma.school.findFirst({ where: { tenantId: tid } });
  if (!school) throw new Error("Okul bulunamadı");
  await prisma.branch.create({
    data: {
      id: `branch_${Date.now().toString(36)}`,
      tenantId: tid,
      schoolId: school.id,
      name: branch.name,
      shortName: branch.shortName,
      address: branch.address,
      phone: branch.phone,
      city: branch.city,
    },
  });
  return readData();
}

export async function updateBranch(
  branchId: string,
  patch: Partial<{ name: string; shortName: string; address: string; phone: string; city: string }>
): Promise<AppData> {
  logger.info("updateBranch", branchId);
  const tid = requireTenantId();
  const result = await prisma.branch.updateMany({
    where: { id: branchId, tenantId: tid },
    data: patch,
  });
  if (result.count === 0) throw new Error("Şube bulunamadı");
  return readData();
}

/**
 * Dört import fonksiyonu da tüm satırları TEK bir `$transaction` içinde
 * işler — kısmi bir hata durumunda hiçbir satır kalıcı olmaz. Şema
 * değişikliği gerektirmeyen manuel upsert: benzersiz kısıt olmadığı için
 * Prisma'nın `upsert()`'ü kullanılamıyor, bunun yerine `findFirst` + `update`
 * ya da `create` uygulanır. Eşitlik karşılaştırmaları MySQL'in varsayılan
 * (case-insensitive) collation'ına güvenir — Postgres'e özgü `mode:
 * "insensitive"` seçeneği bu MySQL şemasında mevcut değildir.
 */
export async function importBranches(rows: BranchImportRow[]): Promise<ImportCommitResult> {
  logger.info("importBranches", rows.length);
  const tid = requireTenantId();
  const school = await prisma.school.findFirst({ where: { tenantId: tid } });
  if (!school) throw new Error("Okul bulunamadı");

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.branch.findFirst({
        where: { tenantId: tid, shortName: row.shortName },
      });
      if (existing) {
        await tx.branch.update({
          where: { id: existing.id },
          data: { name: row.name, shortName: row.shortName, address: row.address, phone: row.phone, city: row.city },
        });
        updated++;
      } else {
        await tx.branch.create({
          data: {
            id: uid("branch"),
            tenantId: tid,
            schoolId: school.id,
            name: row.name,
            shortName: row.shortName,
            address: row.address,
            phone: row.phone,
            city: row.city,
          },
        });
        created++;
      }
    }
  });

  return { data: await readData(), created, updated };
}

export async function importTeachers(rows: TeacherImportRow[]): Promise<ImportCommitResult> {
  logger.info("importTeachers", rows.length);
  const tid = requireTenantId();

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const branch = await tx.branch.findFirst({ where: { id: row.branchId, tenantId: tid } });
      if (!branch) throw new Error(`Şube bulunamadı: ${row.branchId}`);

      const existing = await tx.teacher.findFirst({
        where: { tenantId: tid, email: row.email },
      });
      if (existing) {
        await tx.teacher.update({
          where: { id: existing.id },
          data: { name: row.name, phone: row.phone, branchId: row.branchId, instruments: [row.instrument] },
        });
        updated++;
      } else {
        await tx.teacher.create({
          data: {
            id: uid("tch"),
            tenantId: tid,
            schoolId: branch.schoolId,
            name: row.name,
            email: row.email,
            phone: row.phone,
            branchId: row.branchId,
            instruments: [row.instrument],
            availability: [
              { dayOfWeek: 1, start: "10:00", end: "18:00" },
              { dayOfWeek: 2, start: "10:00", end: "18:00" },
              { dayOfWeek: 3, start: "10:00", end: "18:00" },
              { dayOfWeek: 4, start: "10:00", end: "18:00" },
              { dayOfWeek: 5, start: "10:00", end: "16:00" },
            ],
            maxDailyLessons: 8,
            active: true,
            color: "#7c3aed",
          },
        });
        created++;
      }
    }
  });

  return { data: await readData(), created, updated };
}

export async function importRooms(rows: RoomImportRow[]): Promise<ImportCommitResult> {
  logger.info("importRooms", rows.length);
  const tid = requireTenantId();

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const branch = await tx.branch.findFirst({ where: { id: row.branchId, tenantId: tid } });
      if (!branch) throw new Error(`Şube bulunamadı: ${row.branchId}`);

      const existing = await tx.room.findFirst({
        where: { tenantId: tid, branchId: row.branchId, name: row.name },
      });
      if (existing) {
        await tx.room.update({
          where: { id: existing.id },
          data: { capacity: row.capacity, instruments: row.instruments },
        });
        updated++;
      } else {
        await tx.room.create({
          data: {
            id: uid("room"),
            tenantId: tid,
            schoolId: branch.schoolId,
            name: row.name,
            branchId: row.branchId,
            capacity: row.capacity,
            instruments: row.instruments,
          },
        });
        created++;
      }
    }
  });

  return { data: await readData(), created, updated };
}

export async function importStudents(rows: StudentImportRow[]): Promise<ImportCommitResult> {
  logger.info("importStudents", rows.length);
  const tid = requireTenantId();

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const branch = await tx.branch.findFirst({ where: { id: row.branchId, tenantId: tid } });
      if (!branch) throw new Error(`Şube bulunamadı: ${row.branchId}`);
      const teacher = await tx.teacher.findFirst({ where: { id: row.teacherId, tenantId: tid } });
      if (!teacher) throw new Error(`Öğretmen bulunamadı: ${row.teacherId}`);

      const existing = await tx.student.findFirst({
        where: { tenantId: tid, phone: row.phone.trim() },
      });
      if (existing) {
        await tx.student.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            email: row.email || existing.email,
            parentName: row.parentName,
            parentPhone: row.parentPhone,
            branchId: row.branchId,
            instruments: [row.instrument],
            teacherId: row.teacherId,
            packageName: row.packageName,
            weeklyLessonCount: row.weeklyLessonCount,
            monthlyFee: row.monthlyFee,
            notes: row.notes || existing.notes,
          },
        });
        updated++;
      } else {
        await tx.student.create({
          data: {
            id: uid("stu"),
            tenantId: tid,
            schoolId: branch.schoolId,
            name: row.name,
            email: row.email,
            phone: row.phone,
            parentName: row.parentName,
            parentPhone: row.parentPhone,
            branchId: row.branchId,
            instruments: [row.instrument],
            teacherId: row.teacherId,
            packageName: row.packageName,
            weeklyLessonCount: row.weeklyLessonCount,
            monthlyFee: row.monthlyFee,
            active: true,
            notes: row.notes,
            createdAt: new Date(),
          },
        });
        created++;
      }
    }
  });

  return { data: await readData(), created, updated };
}

export async function addRoom(room: Omit<Room, "id">): Promise<AppData> {
  logger.info("addRoom", room.name);
  const tid = requireTenantId();
  const branch = await prisma.branch.findFirst({
    where: { id: room.branchId, tenantId: tid },
  });
  if (!branch) throw new Error("Şube bulunamadı");
  await prisma.room.create({
    data: {
      id: `room_${Date.now().toString(36)}`,
      tenantId: tid,
      schoolId: branch.schoolId,
      name: room.name,
      branchId: room.branchId,
      capacity: room.capacity,
      instruments: room.instruments,
    },
  });
  return readData();
}

export async function addLesson(input: {
  studentId: string;
  teacherId: string;
  roomId: string;
  instrument: Instrument;
  startAt: string;
}): Promise<AppData> {
  logger.info("addLesson", input.studentId, input.teacherId, input.roomId);
  const tid = requireTenantId();
  const data = await readData();
  const validation = validateLessonSlot(
    data,
    { instrument: input.instrument, studentId: input.studentId },
    { teacherId: input.teacherId, roomId: input.roomId, startAt: input.startAt }
  );
  if (!validation.ok) throw new Error(validation.message);
  const slot = validation.slot;

  const branch = await prisma.branch.findFirst({
    where: { id: slot.branchId, tenantId: tid },
  });
  if (!branch) throw new Error("Şube bulunamadı");

  await prisma.lesson.create({
    data: {
      id: `les_${Date.now().toString(36)}`,
      tenantId: tid,
      studentId: input.studentId,
      teacherId: slot.teacherId,
      roomId: slot.roomId,
      branchId: slot.branchId,
      schoolId: branch.schoolId,
      instrument: input.instrument,
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
      type: "regular",
      status: "scheduled",
    },
  });
  return readData();
}

const CONCURRENT_UPDATE_MESSAGE =
  "Bu ders bu sırada başka bir işlemle değiştirildi. Lütfen sayfayı yenileyip tekrar deneyin.";

/**
 * Şema değişikliği (versiyon kolonu) olmadan iyimser eşzamanlılık kontrolü:
 * WHERE koşulu son okuduğumuz startAt/endAt/status değerlerini de içerir —
 * araya başka bir işlem girip dersi değiştirmişse `updateMany` hiçbir satırı
 * eşleştirmez ve biz bunu çakışma olarak raporlarız (sessizce üzerine yazmayız).
 */
export async function updateLessonSchedule(input: {
  lessonId: string;
  startAt?: string;
  durationMinutes?: number;
}): Promise<AppData> {
  logger.info("updateLessonSchedule", input.lessonId);
  const tid = requireTenantId();
  const data = await readData();
  const original = data.lessons.find((l) => l.id === input.lessonId);
  const result = applyLessonScheduleUpdate(data, input);
  if (!result.ok) throw new Error(result.message);

  const updateResult = await prisma.lesson.updateMany({
    where: {
      id: input.lessonId,
      tenantId: tid,
      startAt: new Date(original!.startAt),
      endAt: new Date(original!.endAt),
      status: original!.status,
    },
    data: {
      startAt: new Date(result.lesson.startAt),
      endAt: new Date(result.lesson.endAt),
    },
  });
  if (updateResult.count === 0) throw new Error(CONCURRENT_UPDATE_MESSAGE);
  return readData();
}

export async function cancelLesson(lessonId: string): Promise<AppData> {
  logger.info("cancelLesson", lessonId);
  const tid = requireTenantId();
  const data = await readData();
  const original = data.lessons.find((l) => l.id === lessonId);
  const result = applyLessonCancel(data, lessonId);
  if (!result.ok) throw new Error(result.message);

  const updateResult = await prisma.lesson.updateMany({
    where: { id: lessonId, tenantId: tid, status: original!.status },
    data: { status: "cancelled" },
  });
  if (updateResult.count === 0) throw new Error(CONCURRENT_UPDATE_MESSAGE);
  return readData();
}

/**
 * Seri + tüm ürettiği Lesson kayıtları TEK `$transaction` içinde yazılır —
 * kısmi bir hata durumunda hiçbir kayıt kalıcı olmaz. Çakışma/uygunluk
 * hesabı `createLessonSeriesData` (saf fonksiyon) ile yapılır; burada
 * yalnızca sonucun Prisma'ya yazılması vardır.
 */
export async function addLessonSeries(
  params: SeriesParams,
  options?: { skipConflicts?: boolean }
): Promise<CreateSeriesResult> {
  logger.info("addLessonSeries", params.studentId, params.teacherId);
  const tid = requireTenantId();
  const data = await readData();

  if (!data.students.some((s) => s.id === params.studentId)) throw new Error("Öğrenci bulunamadı");
  if (!data.teachers.some((t) => t.id === params.teacherId)) throw new Error("Öğretmen bulunamadı");
  if (!data.rooms.some((r) => r.id === params.roomId)) throw new Error("Oda bulunamadı");
  const branch = await prisma.branch.findFirst({ where: { id: params.branchId, tenantId: tid } });
  if (!branch) throw new Error("Şube bulunamadı");

  const result = createLessonSeriesData(data, params, options);
  if (!result.ok) return result;

  const newLessons = result.data.lessons.filter((l) => l.seriesId === result.seriesId);

  await prisma.$transaction(async (tx) => {
    await tx.lessonSeries.create({
      data: {
        id: result.seriesId,
        tenantId: tid,
        schoolId: branch.schoolId,
        studentId: params.studentId,
        teacherId: params.teacherId,
        roomId: params.roomId,
        branchId: params.branchId,
        instrument: params.instrument,
        weekday: params.weekday,
        startTime: params.startTime,
        durationMinutes: params.durationMinutes,
        startsOn: new Date(params.startsOn),
        endsOn: new Date(params.endsOn),
        status: "active",
      },
    });
    for (const lesson of newLessons) {
      await tx.lesson.create({
        data: {
          id: lesson.id,
          tenantId: tid,
          schoolId: branch.schoolId,
          studentId: lesson.studentId,
          teacherId: lesson.teacherId,
          roomId: lesson.roomId,
          branchId: lesson.branchId,
          instrument: lesson.instrument,
          startAt: new Date(lesson.startAt),
          endAt: new Date(lesson.endAt),
          type: lesson.type,
          status: lesson.status,
          seriesId: result.seriesId,
        },
      });
    }
  });

  return {
    ok: true,
    data: await readData(),
    seriesId: result.seriesId,
    createdLessonIds: result.createdLessonIds,
    skippedOccurrences: result.skippedOccurrences,
  };
}

/** "Bu ders ve sonrası": geçmiş dersler dokunulmadan, gelecekteki seri dersleri iptal edilir. */
export async function cancelLessonSeriesFromLesson(lessonId: string): Promise<SeriesCancelResult> {
  logger.info("cancelLessonSeriesFromLesson", lessonId);
  const tid = requireTenantId();
  const data = await readData();
  const result = cancelSeriesFromLesson(data, lessonId);
  if (!result.ok) return result;

  const updatedSeries = result.data.lessonSeries.find(
    (s) => s.id === data.lessons.find((l) => l.id === lessonId)?.seriesId
  );
  if (!updatedSeries) throw new Error("Seri bulunamadı");

  await prisma.$transaction(async (tx) => {
    if (result.cancelledLessonIds.length > 0) {
      await tx.lesson.updateMany({
        where: { id: { in: result.cancelledLessonIds }, tenantId: tid },
        data: { status: "cancelled" },
      });
    }
    await tx.lessonSeries.updateMany({
      where: { id: updatedSeries.id, tenantId: tid },
      data: { status: updatedSeries.status, endsOn: new Date(updatedSeries.endsOn) },
    });
  });

  return { ok: true, data: await readData(), cancelledLessonIds: result.cancelledLessonIds };
}

/** "Tüm seri": geçmiş dersler korunur, gelecekteki tüm seri dersleri iptal edilir, seri cancelled olur. */
export async function cancelEntireLessonSeries(seriesId: string): Promise<SeriesCancelResult> {
  logger.info("cancelEntireLessonSeries", seriesId);
  const tid = requireTenantId();
  const data = await readData();
  const result = cancelEntireSeries(data, seriesId);
  if (!result.ok) return result;

  await prisma.$transaction(async (tx) => {
    if (result.cancelledLessonIds.length > 0) {
      await tx.lesson.updateMany({
        where: { id: { in: result.cancelledLessonIds }, tenantId: tid },
        data: { status: "cancelled" },
      });
    }
    await tx.lessonSeries.updateMany({
      where: { id: seriesId, tenantId: tid },
      data: { status: "cancelled" },
    });
  });

  return { ok: true, data: await readData(), cancelledLessonIds: result.cancelledLessonIds };
}

async function requireTeacherSchoolId(tid: string, teacherId: string): Promise<string> {
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, tenantId: tid } });
  if (!teacher) throw new Error("Öğretmen bulunamadı");
  return teacher.schoolId;
}

export async function addTeacherFeeRule(input: FeeRuleInput): Promise<FeeRuleMutationResult> {
  logger.info("addTeacherFeeRule", input.teacherId);
  const tid = requireTenantId();
  const data = await readData();
  const result = createTeacherFeeRuleData(data, input);
  if (!result.ok) return result;

  const schoolId = await requireTeacherSchoolId(tid, input.teacherId);
  await prisma.teacherFeeRule.create({
    data: {
      id: result.rule.id,
      tenantId: tid,
      teacherId: result.rule.teacherId,
      schoolId,
      branchId: result.rule.branchId,
      instrument: result.rule.instrument,
      perMinuteRate: result.rule.perMinuteRate,
      effectiveFrom: new Date(result.rule.effectiveFrom),
      effectiveTo: result.rule.effectiveTo ? new Date(result.rule.effectiveTo) : undefined,
      createdAt: new Date(result.rule.createdAt),
    },
  });

  return { ok: true, data: await readData(), rule: result.rule };
}

export async function updateTeacherFeeRule(
  ruleId: string,
  patch: Partial<Omit<TeacherFeeRule, "id" | "createdAt">>
): Promise<FeeRuleMutationResult> {
  logger.info("updateTeacherFeeRule", ruleId);
  const tid = requireTenantId();
  const data = await readData();
  const result = updateTeacherFeeRuleData(data, ruleId, patch);
  if (!result.ok) return result;

  await prisma.teacherFeeRule.updateMany({
    where: { id: ruleId, tenantId: tid },
    data: {
      teacherId: result.rule.teacherId,
      branchId: result.rule.branchId ?? null,
      instrument: result.rule.instrument ?? null,
      perMinuteRate: result.rule.perMinuteRate,
      effectiveFrom: new Date(result.rule.effectiveFrom),
      effectiveTo: result.rule.effectiveTo ? new Date(result.rule.effectiveTo) : null,
    },
  });

  return { ok: true, data: await readData(), rule: result.rule };
}

export async function createTeacherPayout(
  teacherId: string,
  periodStart: string,
  periodEnd: string
): Promise<CreateTeacherPayoutResult> {
  logger.info("createTeacherPayout", teacherId, periodStart, periodEnd);
  const tid = requireTenantId();
  const data = await readData();
  const result = createTeacherPayoutSnapshot(data, teacherId, periodStart, periodEnd);
  if (!result.ok) return result;

  const schoolId = await requireTeacherSchoolId(tid, teacherId);
  await prisma.teacherPayout.create({
    data: {
      id: result.payout.id,
      tenantId: tid,
      teacherId: result.payout.teacherId,
      schoolId,
      periodStart: new Date(result.payout.periodStart),
      periodEnd: new Date(result.payout.periodEnd),
      totalMinutes: result.payout.totalMinutes,
      totalAmount: result.payout.totalAmount,
      status: result.payout.status,
      generatedAt: new Date(result.payout.generatedAt),
    },
  });

  return { ok: true, data: await readData(), payout: result.payout };
}

export async function markTeacherPayoutPaid(
  payoutId: string,
  method?: string
): Promise<MarkPayoutPaidResult> {
  logger.info("markTeacherPayoutPaid", payoutId);
  const tid = requireTenantId();
  const data = await readData();
  const result = markTeacherPayoutPaidData(data, payoutId, method);
  if (!result.ok) return result;

  await prisma.teacherPayout.updateMany({
    where: { id: payoutId, tenantId: tid },
    data: { status: "paid", paidAt: new Date(result.payout.paidAt!), method },
  });

  return { ok: true, data: await readData(), payout: result.payout };
}

export async function updateFeeRoundingMode(feeRoundingMode: FeeRoundingMode): Promise<AppData> {
  const tid = requireTenantId();
  await prisma.school.update({ where: { tenantId: tid }, data: { feeRoundingMode } });
  return readData();
}

export async function addPayment(input: {
  studentId: string;
  description: string;
  amount: number;
  dueDate: string;
}): Promise<AppData> {
  logger.info("addPayment", input.studentId, input.amount);
  const tid = requireTenantId();
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, tenantId: tid },
  });
  if (!student) throw new Error("Öğrenci bulunamadı");
  const isOverdue = new Date(input.dueDate).getTime() < Date.now();
  await prisma.payment.create({
    data: {
      id: `pay_${Date.now().toString(36)}`,
      tenantId: tid,
      studentId: input.studentId,
      schoolId: student.schoolId,
      amount: input.amount,
      paidAmount: 0,
      status: isOverdue ? "overdue" : "pending",
      dueDate: new Date(input.dueDate),
      description: input.description,
    },
  });
  return readData();
}
