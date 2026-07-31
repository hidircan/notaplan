import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import { logger } from "./logger";
import { createSeedData } from "./seed";
import type {
  AppData,
  AttendanceStatus,
  BranchId,
  Instrument,
  MakeupSlot,
  Student,
  Teacher,
} from "./types";
import { suggestMakeupSlots, confirmMakeupSlot } from "./makeup-engine";
import { addDays } from "date-fns";
import { requireTenantId, tryTenantId } from "./tenant-context";
import { DEFAULT_TENANT_ID } from "./auth/config";
import { getBootstrapUsersForSeed } from "./auth/users";

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
    attendances: true;
    makeupRequests: true;
    payments: true;
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
      notes: lesson.notes ?? undefined,
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
    prisma.attendance.deleteMany({ where: { tenantId: tid } }),
    prisma.makeupRequest.deleteMany({ where: { tenantId: tid } }),
    prisma.payment.deleteMany({ where: { tenantId: tid } }),
    prisma.lesson.deleteMany({ where: { tenantId: tid } }),
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
  attendances: true,
  makeupRequests: true,
  payments: true,
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
