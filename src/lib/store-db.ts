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
  await prisma.$transaction([
    prisma.attendance.deleteMany(),
    prisma.makeupRequest.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.student.deleteMany(),
    prisma.teacher.deleteMany(),
    prisma.room.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.school.deleteMany(),
  ]);

  const school = await prisma.school.create({
    data: {
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

  return school;
}

export async function readData(): Promise<AppData> {
  const school = await prisma.school.findFirst({
    include: {
      branches: true,
      teachers: true,
      students: true,
      rooms: true,
      lessons: true,
      attendances: true,
      makeupRequests: true,
      payments: true,
    },
  });

  if (!school) {
    logger.info("readData", "no school found, seeding demo data");
    await seedDatabase(createSeedData());
    const seededSchool = await prisma.school.findFirst({
      include: {
        branches: true,
        teachers: true,
        students: true,
        rooms: true,
        lessons: true,
        attendances: true,
        makeupRequests: true,
        payments: true,
      },
    });
    if (!seededSchool) throw new Error("Okul verisi bulunamadı");
    return mapSchoolToAppData(seededSchool);
  }

  return mapSchoolToAppData(school);
}

export async function resetData(): Promise<AppData> {
  logger.info("resetData", "resetting db demo data");
  await seedDatabase(createSeedData());
  return readData();
}

export async function markAttendance(input: {
  lessonId: string;
  status: AttendanceStatus;
  reason?: string;
}): Promise<AppData> {
  logger.info("markAttendance", input.lessonId, input.status);

  const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
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

  await prisma.lesson.update({
    where: { id: input.lessonId },
    data: { status: lessonStatus },
  });

  let attendanceId: string;
  const existingAttendance = await prisma.attendance.findFirst({
    where: { lessonId: input.lessonId },
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
    where: { sourceLessonId: input.lessonId },
  });

  if (createsMakeupCredit) {
    const branch = await prisma.branch.findUnique({ where: { id: lesson.branchId } });
    const school = await prisma.school.findUnique({ where: { id: lesson.schoolId } });
    const policyNote =
      input.status === "cancelled_by_school"
        ? `Okul kaynaklı iptal — öncelikli yerleştirme · ${branch?.shortName ?? ""}`
        : `${school?.makeupWindowDays ?? 0} gün içinde · aynı öğretmen · ${branch?.shortName ?? ""}`;

    await prisma.makeupRequest.create({
      data: {
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

export async function generateSuggestions(requestId: string): Promise<AppData> {
  logger.info("generateSuggestions", requestId);
  const data = await readData();
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");

  const slots = suggestMakeupSlots(data, request);
  const slotsJson = JSON.parse(JSON.stringify(slots)) as Prisma.JsonArray;
  await prisma.makeupRequest.update({
    where: { id: requestId },
    data: { status: "suggested", suggestedSlots: slotsJson },
  });
  return readData();
}

export async function confirmSlot(requestId: string, slot: MakeupSlot): Promise<AppData> {
  logger.info("confirmSlot", requestId, slot.startAt, slot.teacherId, slot.roomId);
  const data = await readData();
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");

  const { lessonId } = confirmMakeupSlot(data, requestId, slot);

  const branch = await prisma.branch.findUnique({ where: { id: request.branchId } });
  if (!branch) throw new Error("Şube bulunamadı");

  await prisma.lesson.create({
    data: {
      id: lessonId,
      studentId: request.studentId,
      teacherId: slot.teacherId,
      roomId: slot.roomId,
      branchId: slot.branchId,
      schoolId: branch.schoolId,
      instrument: request.instrument,
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
      type: "makeup",
      status: "scheduled",
      makeupRequestId: requestId,
      notes: `Telafi · kaynak ders ${request.sourceLessonId}`,
    },
  });

  await prisma.makeupRequest.update({
    where: { id: requestId },
    data: { status: "confirmed", confirmedLessonId: lessonId },
  });

  return readData();
}

export async function cancelMakeup(requestId: string): Promise<AppData> {
  logger.info("cancelMakeup", requestId);
  await prisma.makeupRequest.update({
    where: { id: requestId },
    data: { status: "cancelled" },
  });
  return readData();
}

export async function addStudent(
  student: Omit<Student, "id" | "createdAt" | "active">
): Promise<AppData> {
  logger.info("addStudent", student.name);
  const branch = await prisma.branch.findUnique({ where: { id: student.branchId } });
  if (!branch) throw new Error("Şube bulunamadı");
  await prisma.student.create({
    data: {
      ...student,
      id: `stu_${Date.now().toString(36)}`,
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
  const branch = await prisma.branch.findUnique({ where: { id: teacher.branchId } });
  if (!branch) throw new Error("Şube bulunamadı");
  const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#059669", "#4f46e5"];
  await prisma.teacher.create({
    data: {
      ...teacher,
      id: `tch_${Date.now().toString(36)}`,
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
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Ödeme bulunamadı");

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "paid",
      paidAmount: payment.amount,
      paidAt: new Date(),
    },
  });

  return readData();
}
