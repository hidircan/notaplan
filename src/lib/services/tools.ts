/**
 * AI Tool Layer — single source of business operations.
 * Reuses existing store + makeup-engine + whatsapp templates.
 * Consumable by Web actions, future Mobile API, and AI agents.
 */

import { z } from "zod";
import {
  addBranch,
  addLesson,
  addLessonSeries,
  addPayment,
  addRoom,
  addStudent,
  addTeacher,
  cancelEntireLessonSeries,
  cancelLesson,
  cancelLessonSeriesFromLesson,
  cancelMakeup,
  confirmSlot,
  generateSuggestions,
  importBranches,
  importRooms,
  importStudents,
  importTeachers,
  markAttendance,
  markPaymentPaid,
  readData,
  resetData,
  updateBranch,
  updateLessonSchedule,
} from "../store";
import { suggestMakeupSlots } from "../makeup-engine";
import { suggestLessonSlots, type LessonSlotSuggestion } from "../lesson-scheduling";
import {
  buildSeriesPreviewText,
  checkSeriesOccurrences,
  computeSeriesOccurrences,
  type SeriesOccurrenceCheck,
} from "../lesson-series";
import { clearFollowUpCases } from "../tahsilat/cases";
import { parseCsv, rowsToRecords } from "../import/csv";
import { validateBranchRows, type BranchImportRow } from "../import/branches";
import { validateTeacherRows, type TeacherImportRow } from "../import/teachers";
import { validateRoomRows, type RoomImportRow } from "../import/rooms";
import { validateStudentRows, type StudentImportRow } from "../import/students";
import type { ImportPreview } from "../import/types";
import type { ImportCommitResult } from "../import/commit-result";
import {
  templateMakeupConfirmed,
  templateMakeupCreated,
  templateTeacherMakeupAssigned,
  type WaMessage,
} from "../whatsapp-templates";
import {
  attendanceSchema,
  branchSchema,
  cancelEntireSeriesSchema,
  cancelLessonSchema,
  cancelSeriesFromLessonSchema,
  createLessonSeriesSchema,
  lessonSchema,
  lessonSeriesParamsSchema,
  makeupSlotSchema,
  paymentRecordSchema,
  roomSchema,
  studentSchema,
  suggestLessonSlotsSchema,
  teacherSchema,
  updateBranchSchema,
  updateLessonScheduleSchema,
} from "../validation";
import type { BranchId, Instrument, MakeupSlot, Student, Teacher } from "../types";
import {
  canAccessStudent,
  canAccessTeacher,
  requireRole,
  type ServiceContext,
} from "./context";
import { fail, fromZodError, ok, type ServiceResult } from "./result";

// ─── helpers ───────────────────────────────────────────────

function parseOrFail<T>(schema: z.ZodType<T>, input: unknown): ServiceResult<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error.flatten());
  return ok(parsed.data);
}

// ─── tools ─────────────────────────────────────────────────

export async function markAttendanceTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ lessonId: string; status: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(attendanceSchema, input);
  if (!v.ok) return v;

  if (ctx.role === "TEACHER") {
    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === v.data.lessonId);
    if (!lesson) return fail("NOT_FOUND", "Lesson not found");
    if (!canAccessTeacher(ctx, lesson.teacherId)) {
      return fail("FORBIDDEN", "Cannot mark attendance for another teacher's lesson");
    }
  }

  try {
    await markAttendance(v.data);
    return ok({ lessonId: v.data.lessonId, status: v.data.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "markAttendance failed");
  }
}

export async function findAvailableSlotsTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requestId: string; slots: MakeupSlot[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      requestId: z.string().min(1),
      maxSlots: z.number().int().positive().max(50).optional(),
    }),
    input
  );
  if (!v.ok) return v;

  try {
    const data = await readData();
    const request = data.makeupRequests.find((m) => m.id === v.data.requestId);
    if (!request) return fail("NOT_FOUND", "Makeup request not found");

    const options = v.data.maxSlots ? { maxSlots: v.data.maxSlots } : undefined;
    const slots = suggestMakeupSlots(data, request, options);
    // Persist suggestions via existing store path
    await generateSuggestions(v.data.requestId, options);
    return ok({ requestId: v.data.requestId, slots });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "findAvailableSlots failed");
  }
}

export async function confirmMakeupLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requestId: string; lessonId?: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      requestId: z.string().min(1),
      slot: makeupSlotSchema,
    }),
    input
  );
  if (!v.ok) return v;

  try {
    await confirmSlot(v.data.requestId, v.data.slot as MakeupSlot);
    const data = await readData();
    const req = data.makeupRequests.find((m) => m.id === v.data.requestId);
    return ok({ requestId: v.data.requestId, lessonId: req?.confirmedLessonId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "confirmMakeupLesson failed");
  }
}

export async function createMakeupLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requestId: string }>> {
  /** Creates makeup credit via attendance (absent / school cancel) — reuses store */
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    attendanceSchema.extend({
      status: z.enum(["absent", "cancelled_by_school"]),
    }),
    input
  );
  if (!v.ok) return v;

  try {
    await markAttendance(v.data);
    const data = await readData();
    const req = data.makeupRequests.find((m) => m.sourceLessonId === v.data.lessonId);
    if (!req) return fail("CONFLICT", "Makeup request was not created");
    return ok({ requestId: req.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createMakeupLesson failed");
  }
}

export async function cancelMakeupLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requestId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ requestId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    await cancelMakeup(v.data.requestId);
    return ok({ requestId: v.data.requestId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "cancelMakeup failed");
  }
}

export async function findAvailableTeachersTool(
  ctx: ServiceContext,
  input: unknown
): Promise<
  ServiceResult<{
    teachers: Array<{ id: string; name: string; branchId: string; instruments: string[] }>;
  }>
> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN", "TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      instrument: z.string().optional(),
      branchId: z.string().min(1).optional(),
    }),
    input ?? {}
  );
  if (!v.ok) return v;

  const data = await readData();
  let teachers = data.teachers.filter((t) => t.active);
  if (v.data.instrument) {
    teachers = teachers.filter((t) =>
      t.instruments.includes(v.data.instrument as Instrument)
    );
  }
  if (v.data.branchId) {
    teachers = teachers.filter((t) => t.branchId === v.data.branchId);
  }

  return ok({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      branchId: t.branchId,
      instruments: t.instruments,
    })),
  });
}

export async function getStudentScheduleTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ studentId: string; lessons: unknown[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "PARENT", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;
  if (!canAccessStudent(ctx, v.data.studentId)) {
    return fail("FORBIDDEN", "Cannot access this student's schedule");
  }

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Student not found");

  const lessons = data.lessons
    .filter((l) => l.studentId === v.data.studentId)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return ok({ studentId: v.data.studentId, lessons });
}

export async function getTeacherScheduleTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ teacherId: string; lessons: unknown[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ teacherId: z.string().min(1) }), input);
  if (!v.ok) return v;
  if (!canAccessTeacher(ctx, v.data.teacherId)) {
    return fail("FORBIDDEN", "Cannot access this teacher's schedule");
  }

  const data = await readData();
  const teacher = data.teachers.find((t) => t.id === v.data.teacherId);
  if (!teacher) return fail("NOT_FOUND", "Teacher not found");

  const lessons = data.lessons
    .filter((l) => l.teacherId === v.data.teacherId)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return ok({ teacherId: v.data.teacherId, lessons });
}

export async function getParentBalanceTool(
  ctx: ServiceContext,
  input: unknown
): Promise<
  ServiceResult<{
    studentId: string;
    payments: unknown[];
    outstanding: number;
  }>
> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "PARENT", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;
  if (!canAccessStudent(ctx, v.data.studentId)) {
    return fail("FORBIDDEN", "Cannot access this balance");
  }

  const data = await readData();
  const payments = data.payments.filter((p) => p.studentId === v.data.studentId);
  const outstanding = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.amount - p.paidAmount), 0);

  return ok({ studentId: v.data.studentId, payments, outstanding });
}

export async function createPaymentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ paymentId: string; status: string }>> {
  /** Marks existing payment as paid — create-new not in store yet */
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ paymentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    await markPaymentPaid(v.data.paymentId);
    return ok({ paymentId: v.data.paymentId, status: "paid" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createPayment failed");
  }
}

export async function sendParentMessageTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ message: WaMessage }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN", "TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      studentId: z.string().min(1),
      kind: z.enum(["makeup_created", "makeup_confirmed"]).default("makeup_created"),
      makeupRequestId: z.string().optional(),
    }),
    input
  );
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Student not found");

  let message: WaMessage | null = null;
  if (v.data.kind === "makeup_created") {
    const req = data.makeupRequests.find(
      (m) =>
        m.id === v.data.makeupRequestId ||
        (m.studentId === student.id && (m.status === "pending" || m.status === "suggested"))
    );
    if (!req) return fail("NOT_FOUND", "Makeup request not found for parent message");
    const branch = data.settings.branches.find((b) => b.id === req.branchId);
    message = templateMakeupCreated(data.settings.name, student, req, branch?.shortName ?? "");
  } else {
    const req = data.makeupRequests.find(
      (m) => m.id === v.data.makeupRequestId && m.status === "confirmed"
    );
    if (!req?.confirmedLessonId) {
      return fail("NOT_FOUND", "Confirmed makeup lesson not found");
    }
    const lesson = data.lessons.find((l) => l.id === req.confirmedLessonId);
    const teacher = data.teachers.find((t) => t.id === lesson?.teacherId);
    const branch = data.settings.branches.find((b) => b.id === lesson?.branchId);
    if (!lesson || !teacher) return fail("NOT_FOUND", "Lesson or teacher missing");
    message = templateMakeupConfirmed(
      data.settings.name,
      student,
      lesson,
      teacher,
      branch?.shortName || ""
    );
  }

  return ok({ message });
}

export async function sendTeacherMessageTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ message: WaMessage }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      makeupRequestId: z.string().min(1),
    }),
    input
  );
  if (!v.ok) return v;

  const data = await readData();
  const req = data.makeupRequests.find((m) => m.id === v.data.makeupRequestId);
  if (!req?.confirmedLessonId) return fail("NOT_FOUND", "Confirmed makeup not found");
  const lesson = data.lessons.find((l) => l.id === req.confirmedLessonId);
  const teacher = data.teachers.find((t) => t.id === lesson?.teacherId);
  const student = data.students.find((s) => s.id === req.studentId);
  const branch = data.settings.branches.find((b) => b.id === lesson?.branchId);
  if (!lesson || !teacher || !student) return fail("NOT_FOUND", "Related entities missing");

  const message = templateTeacherMakeupAssigned(
    data.settings.name,
    teacher,
    student,
    lesson,
    branch?.shortName || ""
  );
  return ok({ message });
}

export async function createStudentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ studentId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(studentSchema, input);
  if (!v.ok) return v;

  try {
    const before = await readData();
    const ids = new Set(before.students.map((s) => s.id));
    await addStudent({
      ...v.data,
      instruments: [v.data.instrument as Instrument],
      email: v.data.email ?? "",
      notes: v.data.notes ?? "",
    });
    const after = await readData();
    const created = after.students.find((s) => !ids.has(s.id));
    return ok({ studentId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createStudent failed");
  }
}

export async function createTeacherTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ teacherId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(teacherSchema, input);
  if (!v.ok) return v;

  try {
    const before = await readData();
    const ids = new Set(before.teachers.map((t) => t.id));
    await addTeacher({
      name: v.data.name,
      email: v.data.email ?? "",
      phone: v.data.phone,
      branchId: v.data.branchId as BranchId,
      instruments: [v.data.instrument as Instrument],
      availability: [
        { dayOfWeek: 1, start: "10:00", end: "18:00" },
        { dayOfWeek: 2, start: "10:00", end: "18:00" },
        { dayOfWeek: 3, start: "10:00", end: "18:00" },
        { dayOfWeek: 4, start: "10:00", end: "18:00" },
        { dayOfWeek: 5, start: "10:00", end: "16:00" },
      ],
      maxDailyLessons: 8,
    });
    const after = await readData();
    const created = after.teachers.find((t) => !ids.has(t.id));
    return ok({ teacherId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createTeacher failed");
  }
}

export async function createBranchTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ branchId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(branchSchema, input);
  if (!v.ok) return v;

  try {
    const before = await readData();
    const ids = new Set(before.settings.branches.map((b) => b.id));
    await addBranch(v.data);
    const after = await readData();
    const created = after.settings.branches.find((b) => !ids.has(b.id));
    return ok({ branchId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createBranch failed");
  }
}

export async function updateBranchTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ branchId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateBranchSchema, input);
  if (!v.ok) return v;

  try {
    const { branchId, ...patch } = v.data;
    await updateBranch(branchId, patch);
    return ok({ branchId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateBranch failed");
  }
}

const csvInputSchema = z.object({ csvText: z.string().min(1) });

function csvRecords(csvText: string) {
  return rowsToRecords(parseCsv(csvText)).records;
}

export async function previewBranchImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportPreview<BranchImportRow>>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  return ok(validateBranchRows(csvRecords(v.data.csvText)));
}

export async function commitBranchImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportCommitResult>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  const preview = validateBranchRows(csvRecords(v.data.csvText));
  if (preview.errorCount > 0) {
    return fail("VALIDATION_ERROR", "CSV içinde hatalı satır var; hiçbir kayıt eklenmedi.", preview.errors);
  }
  if (preview.valid.length === 0) return fail("VALIDATION_ERROR", "İçe aktarılacak geçerli satır yok.");
  try {
    return ok(await importBranches(preview.valid));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "importBranches failed");
  }
}

export async function previewTeacherImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportPreview<TeacherImportRow>>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  const data = await readData();
  return ok(validateTeacherRows(data, csvRecords(v.data.csvText)));
}

export async function commitTeacherImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportCommitResult>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  const data = await readData();
  const preview = validateTeacherRows(data, csvRecords(v.data.csvText));
  if (preview.errorCount > 0) {
    return fail("VALIDATION_ERROR", "CSV içinde hatalı satır var; hiçbir kayıt eklenmedi.", preview.errors);
  }
  if (preview.valid.length === 0) return fail("VALIDATION_ERROR", "İçe aktarılacak geçerli satır yok.");
  try {
    return ok(await importTeachers(preview.valid));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "importTeachers failed");
  }
}

export async function previewRoomImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportPreview<RoomImportRow>>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  const data = await readData();
  return ok(validateRoomRows(data, csvRecords(v.data.csvText)));
}

export async function commitRoomImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportCommitResult>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  const data = await readData();
  const preview = validateRoomRows(data, csvRecords(v.data.csvText));
  if (preview.errorCount > 0) {
    return fail("VALIDATION_ERROR", "CSV içinde hatalı satır var; hiçbir kayıt eklenmedi.", preview.errors);
  }
  if (preview.valid.length === 0) return fail("VALIDATION_ERROR", "İçe aktarılacak geçerli satır yok.");
  try {
    return ok(await importRooms(preview.valid));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "importRooms failed");
  }
}

export async function previewStudentImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportPreview<StudentImportRow>>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  const data = await readData();
  return ok(validateStudentRows(data, csvRecords(v.data.csvText)));
}

export async function commitStudentImportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<ImportCommitResult>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(csvInputSchema, input);
  if (!v.ok) return v;
  const data = await readData();
  const preview = validateStudentRows(data, csvRecords(v.data.csvText));
  if (preview.errorCount > 0) {
    return fail("VALIDATION_ERROR", "CSV içinde hatalı satır var; hiçbir kayıt eklenmedi.", preview.errors);
  }
  if (preview.valid.length === 0) return fail("VALIDATION_ERROR", "İçe aktarılacak geçerli satır yok.");
  try {
    return ok(await importStudents(preview.valid));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "importStudents failed");
  }
}

export async function createRoomTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ roomId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(roomSchema, input);
  if (!v.ok) return v;

  try {
    const before = await readData();
    const ids = new Set(before.rooms.map((r) => r.id));
    await addRoom({
      name: v.data.name,
      branchId: v.data.branchId as BranchId,
      capacity: v.data.capacity,
      instruments: v.data.instruments as Instrument[],
    });
    const after = await readData();
    const created = after.rooms.find((r) => !ids.has(r.id));
    return ok({ roomId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createRoom failed");
  }
}

export async function suggestLessonSlotsTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ suggestions: LessonSlotSuggestion[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(suggestLessonSlotsSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const suggestions = suggestLessonSlots(data, {
    studentId: v.data.studentId,
    instrument: v.data.instrument as Instrument,
    teacherId: v.data.teacherId,
    daysAhead: v.data.daysAhead,
    maxSlots: v.data.maxSlots,
  });
  return ok({ suggestions });
}

export async function createLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ lessonId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(lessonSchema, input);
  if (!v.ok) return v;

  try {
    const before = await readData();
    const ids = new Set(before.lessons.map((l) => l.id));
    await addLesson({
      studentId: v.data.studentId,
      teacherId: v.data.teacherId,
      roomId: v.data.roomId,
      instrument: v.data.instrument as Instrument,
      startAt: v.data.startAt,
    });
    const after = await readData();
    const created = after.lessons.find((l) => !ids.has(l.id));
    return ok({ lessonId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createLesson failed");
  }
}

export async function updateLessonScheduleTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ lessonId: string; startAt: string; endAt: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateLessonScheduleSchema, input);
  if (!v.ok) return v;

  try {
    await updateLessonSchedule(v.data);
    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === v.data.lessonId);
    if (!lesson) return fail("NOT_FOUND", "Ders bulunamadı");
    return ok({ lessonId: lesson.id, startAt: lesson.startAt, endAt: lesson.endAt });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateLessonSchedule failed");
  }
}

export async function cancelLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ lessonId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(cancelLessonSchema, input);
  if (!v.ok) return v;

  try {
    await cancelLesson(v.data.lessonId);
    return ok({ lessonId: v.data.lessonId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "cancelLesson failed");
  }
}

/**
 * Dönemlik seri için hiçbir kayıt YAZMADAN önizleme üretir: Türkçe onay
 * cümlesi + her oluşumun tek doğrulama kaynağından (validateLessonSlot)
 * geçmiş çakışma/uygunluk sonucu.
 */
export async function previewLessonSeriesTool(
  ctx: ServiceContext,
  input: unknown
): Promise<
  ServiceResult<{
    previewText: string;
    occurrenceCount: number;
    conflictCount: number;
    checks: SeriesOccurrenceCheck[];
  }>
> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(lessonSeriesParamsSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı.");
  if (!data.teachers.some((t) => t.id === v.data.teacherId)) return fail("NOT_FOUND", "Öğretmen bulunamadı.");
  if (!data.rooms.some((r) => r.id === v.data.roomId)) return fail("NOT_FOUND", "Oda bulunamadı.");
  if (!data.settings.branches.some((b) => b.id === v.data.branchId)) return fail("NOT_FOUND", "Şube bulunamadı.");

  const occurrences = computeSeriesOccurrences(v.data);
  const checks = checkSeriesOccurrences(data, v.data, occurrences);
  const previewText = buildSeriesPreviewText({
    studentName: student.name,
    weekday: v.data.weekday,
    startTime: v.data.startTime,
    durationMinutes: v.data.durationMinutes,
    startsOn: v.data.startsOn,
    endsOn: v.data.endsOn,
    occurrenceCount: occurrences.length,
  });

  return ok({
    previewText,
    occurrenceCount: occurrences.length,
    conflictCount: checks.filter((c) => !c.ok).length,
    checks,
  });
}

export async function createLessonSeriesTool(
  ctx: ServiceContext,
  input: unknown
): Promise<
  ServiceResult<{
    seriesId: string;
    createdLessonIds: string[];
    skippedOccurrences: { startAt: string; code: string; message: string }[];
  }>
> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createLessonSeriesSchema, input);
  if (!v.ok) return v;

  try {
    const { skipConflicts, ...params } = v.data;
    const result = await addLessonSeries(params, { skipConflicts });
    if (!result.ok) return fail("CONFLICT", result.message, result.conflicts);
    return ok({
      seriesId: result.seriesId,
      createdLessonIds: result.createdLessonIds,
      skippedOccurrences: result.skippedOccurrences,
    });
  } catch (e) {
    return fail("NOT_FOUND", e instanceof Error ? e.message : "createLessonSeries failed");
  }
}

export async function cancelSeriesFromLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ cancelledLessonIds: string[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(cancelSeriesFromLessonSchema, input);
  if (!v.ok) return v;

  try {
    const result = await cancelLessonSeriesFromLesson(v.data.lessonId);
    if (!result.ok) return fail("NOT_FOUND", result.message);
    return ok({ cancelledLessonIds: result.cancelledLessonIds });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "cancelSeriesFromLesson failed");
  }
}

export async function cancelEntireSeriesTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ cancelledLessonIds: string[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(cancelEntireSeriesSchema, input);
  if (!v.ok) return v;

  try {
    const result = await cancelEntireLessonSeries(v.data.seriesId);
    if (!result.ok) return fail("NOT_FOUND", result.message);
    return ok({ cancelledLessonIds: result.cancelledLessonIds });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "cancelEntireSeries failed");
  }
}

export async function createPaymentRecordTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ paymentId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(paymentRecordSchema, input);
  if (!v.ok) return v;

  try {
    const before = await readData();
    const ids = new Set(before.payments.map((p) => p.id));
    await addPayment({
      studentId: v.data.studentId,
      description: v.data.description,
      amount: v.data.amount,
      dueDate: v.data.dueDate,
    });
    const after = await readData();
    const created = after.payments.find((p) => !ids.has(p.id));
    return ok({ paymentId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createPaymentRecord failed");
  }
}

export async function resetDemoTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ reset: true }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  try {
    await resetData();
    // Tahsilat takip vakaları AppData'nın dışında ayrı bir store'da tutulur;
    // demo sıfırlamasının tekrarlanabilir olması için onları da temizle.
    await clearFollowUpCases(ctx.tenantId);
    return ok({ reset: true });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "reset failed");
  }
}

/**
 * @deprecated Prefer `@/lib/agent` listToolDefinitions / TOOL_REGISTRY.
 * Kept for backward-compatible imports.
 */
export const TOOL_CATALOG = [
  { name: "markAttendance", description: "Mark lesson attendance; may create makeup credit" },
  { name: "findAvailableSlots", description: "Suggest makeup slots for a request" },
  { name: "confirmMakeupLesson", description: "Confirm a makeup slot and schedule lesson" },
  { name: "createMakeupLesson", description: "Create makeup credit from absence/cancel" },
  { name: "cancelMakeupLesson", description: "Cancel a makeup request" },
  { name: "findAvailableTeachers", description: "List teachers by instrument/branch" },
  { name: "getStudentSchedule", description: "Get lessons for a student" },
  { name: "getTeacherSchedule", description: "Get lessons for a teacher" },
  { name: "getParentBalance", description: "Get payment balance for a student" },
  { name: "createPayment", description: "Mark a payment as paid" },
  { name: "sendParentMessage", description: "Build WhatsApp message for parent" },
  { name: "sendTeacherMessage", description: "Build WhatsApp message for teacher" },
  { name: "createStudent", description: "Register a student" },
  { name: "createTeacher", description: "Register a teacher" },
  { name: "suggestLessonSlots", description: "Suggest available times for a regular lesson" },
  { name: "updateLessonSchedule", description: "Move or resize a regular lesson" },
  { name: "cancelLesson", description: "Cancel a regular lesson" },
  { name: "previewLessonSeries", description: "Preview a recurring weekly lesson series without writing" },
  { name: "createLessonSeries", description: "Create a recurring weekly lesson series" },
  { name: "cancelSeriesFromLesson", description: "Cancel a series from a given lesson onward" },
  { name: "cancelEntireSeries", description: "Cancel an entire lesson series" },
  { name: "createBranch", description: "Add a new branch" },
  { name: "updateBranch", description: "Edit an existing branch" },
  { name: "previewBranchImport", description: "Validate a branches CSV without writing" },
  { name: "commitBranchImport", description: "Import branches from CSV" },
  { name: "previewTeacherImport", description: "Validate a teachers CSV without writing" },
  { name: "commitTeacherImport", description: "Import teachers from CSV" },
  { name: "previewRoomImport", description: "Validate a rooms CSV without writing" },
  { name: "commitRoomImport", description: "Import rooms from CSV" },
  { name: "previewStudentImport", description: "Validate a students CSV without writing" },
  { name: "commitStudentImport", description: "Import students from CSV" },
  { name: "resetDemo", description: "Reset tenant demo data" },
] as const;

// silence unused type imports when tree-shaken
export type { Student, Teacher };
