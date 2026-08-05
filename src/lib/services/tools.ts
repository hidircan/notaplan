/**
 * AI Tool Layer — single source of business operations.
 * Reuses existing store + makeup-engine + whatsapp templates.
 * Consumable by Web actions, future Mobile API, and AI agents.
 */

import { z } from "zod";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  addBranch,
  addLesson,
  addLessonSeries,
  addPayment,
  addRoom,
  addStudent,
  addTeacher,
  addTeacherFeeRule,
  cancelEntireLessonSeries,
  cancelLesson,
  cancelLessonSeriesFromLesson,
  cancelMakeup,
  confirmSlot,
  correctLessonTimesLive,
  createTeacherPayout,
  endLessonLive,
  generateSuggestions,
  importBranches,
  importRooms,
  importStudents,
  importTeachers,
  markAttendance,
  markPaymentPaid,
  markTeacherPayoutPaid,
  readData,
  resetData,
  startLessonLive,
  updateBranch,
  updateCollectionsSettings,
  updateFeeRoundingMode,
  updateLessonSchedule,
  updateMakeupSlaEscalation,
  updateStudentProfile,
  updateTeacherAvailability,
  updateTeacherFeeRule,
} from "../store";
import { computeTeacherEarningsForPeriod, type TeacherEarningsResult } from "../teacher-payout";
import {
  suggestMakeupSlots,
  resolveSlaEscalationLevel,
  type MakeupSlaEscalation,
} from "../makeup-engine";
import { suggestLessonSlots, type LessonSlotSuggestion } from "../lesson-scheduling";
import {
  buildSeriesPreviewText,
  checkSeriesOccurrences,
  computeSeriesOccurrences,
  type SeriesOccurrenceCheck,
} from "../lesson-series";
import { clearFollowUpCases, listFollowUpCases, upsertFollowUpCase } from "../tahsilat/cases";
import {
  clearNotifications,
  createNotification,
  listNotificationsForUser,
  markNotificationRead,
} from "../notifications";
import {
  clearAnnouncements,
  createAnnouncement,
  listAnnouncements,
  listReadUserIds,
  markAnnouncementRead,
  updateAnnouncementStatus,
} from "../announcements";
import { isVisibleNow, matchesAudience } from "../announcements/audience";
import {
  clearAssessments,
  createAssessment,
  getAssessment,
  listAssessmentsForStudent,
} from "../assessment";
import {
  computeTrend,
  stripPrivateNoteForRecipient,
  type AssessmentTrendPoint,
} from "../assessment/score";
import {
  clearAvailabilityRequests,
  createAvailabilityRequest,
  getAvailabilityRequest,
  listAvailabilityRequestsForTeacher,
  reviewAvailabilityRequest,
} from "../teacher-availability";
import {
  clearHomework,
  createHomework,
  getHomework,
  getSubmission,
  listHomeworkForStudent,
  listHomeworkForTeacher,
  listSubmissionsForHomework,
  reviewSubmission,
  submitHomework,
} from "../homework";
import {
  clearTeachingMaterials,
  createTeachingMaterial,
  getTeachingMaterial,
  listTeachingMaterialsForTeacher,
} from "../teaching-materials";
import { matchesMaterialAudience } from "../teaching-materials-audience";
import {
  clearTeacherFeedback,
  listTeacherFeedback,
  submitTeacherFeedback,
} from "../teacher-feedback";
import { formatMoney } from "../utils";
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
  computeTeacherPayoutSchema,
  correctLessonTimesSchema,
  createAnnouncementSchema,
  createAssessmentSchema,
  createFeeRuleSchema,
  createLessonSeriesSchema,
  createTeacherPayoutSchema,
  endLessonSchema,
  lessonSchema,
  lessonSeriesParamsSchema,
  makeupSlotSchema,
  markAnnouncementReadSchema,
  markNotificationReadSchema,
  markTeacherPayoutPaidSchema,
  createHomeworkSchema,
  createTeachingMaterialSchema,
  paymentRecordSchema,
  proposeTeacherAvailabilitySchema,
  reviewHomeworkSubmissionSchema,
  reviewTeacherAvailabilityRequestSchema,
  roomSchema,
  submitHomeworkSchema,
  submitTeacherFeedbackSchema,
  startLessonSchema,
  studentSchema,
  suggestLessonSlotsSchema,
  teacherSchema,
  updateAnnouncementStatusSchema,
  updateBranchSchema,
  updateCollectionsSettingsSchema,
  updateCommunicationPreferenceSchema,
  updateFeeRoundingModeSchema,
  updateFeeRuleSchema,
  updateLessonScheduleSchema,
  updateStudentProfileSchema,
} from "../validation";
import {
  DEFAULT_COLLECTIONS_SETTINGS,
  type Announcement,
  type AnnouncementAudienceRef,
  type AnnouncementStatus,
  type BranchId,
  type CollectionsSettings,
  type FeeRoundingMode,
  type Homework,
  type HomeworkSubmission,
  type Instrument,
  type LessonAssessment,
  type MakeupSlot,
  type Notification,
  type Student,
  type Teacher,
  type TeacherAvailabilityRequest,
  type TeacherFeedback,
  type TeacherFeeRule,
  type TeacherPayout,
  type TeachingMaterial,
} from "../types";
import {
  assertStudentAccess,
  canAccessStudent,
  canAccessTeacher,
  requireRole,
  type ServiceContext,
} from "./context";
import { fail, fromZodError, ok, type ServiceErrorCode, type ServiceResult } from "./result";
import { recordAuditLog } from "../audit/log";

/** Fire-and-forget critical-action audit write — never awaited, never blocks the tool's return. */
function audit(
  ctx: ServiceContext,
  action: string,
  entityType: string,
  entityId: string,
  meta?: Record<string, unknown>
) {
  void recordAuditLog({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    action,
    entityType,
    entityId,
    outcome: "success",
    meta,
  });
}

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

/**
 * EPIC 10 — `decisionNote` ZORUNLU (kasıtlı, dokümante edilmiş sözleşme
 * kırılması): "onay/iptal/ret işlemlerinde karar notu zorunlu olmalı" ürün
 * kararı geriye dönük uyumluluktan önceliklidir. Onay, 30 günlük SLA
 * sayacını başlatır (bkz. `confirmMakeupSlot`/`computeSlaDeadline`).
 */
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
      decisionNote: z.string().min(1, "Karar notu zorunludur"),
    }),
    input
  );
  if (!v.ok) return v;

  try {
    await confirmSlot(v.data.requestId, v.data.slot as MakeupSlot, {
      decisionNote: v.data.decisionNote,
      decidedBy: ctx.userId,
    });
    const data = await readData();
    const req = data.makeupRequests.find((m) => m.id === v.data.requestId);
    audit(ctx, "makeup.confirm", "MakeupRequest", v.data.requestId, {
      lessonId: req?.confirmedLessonId,
      decisionNote: v.data.decisionNote,
    });
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

  if (ctx.role === "TEACHER") {
    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === v.data.lessonId);
    if (!lesson) return fail("NOT_FOUND", "Ders bulunamadı");
    if (!canAccessTeacher(ctx, lesson.teacherId)) {
      return fail("FORBIDDEN", "Yalnızca kendi dersiniz için telafi oluşturabilirsiniz.");
    }
  }

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

/** EPIC 10 — `decisionNote` ZORUNLU; hem iptal hem ret akışı bu tek yolu kullanır. */
export async function cancelMakeupLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requestId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      requestId: z.string().min(1),
      decisionNote: z.string().min(1, "Karar notu zorunludur"),
    }),
    input
  );
  if (!v.ok) return v;

  try {
    await cancelMakeup(v.data.requestId, { decisionNote: v.data.decisionNote, decidedBy: ctx.userId });
    audit(ctx, "makeup.cancel", "MakeupRequest", v.data.requestId, {
      decisionNote: v.data.decisionNote,
    });
    return ok({ requestId: v.data.requestId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "cancelMakeup failed");
  }
}

/**
 * EPIC 10 — SLA eskalasyon taraması. Yalnızca `slaDeadline` set edilmiş
 * (yani onaylanmış) talepleri kontrol eder; seviyesi YÜKSELEN her talep için
 * kaydı günceller + audit log yazar — aynı eşik için tekrar bildirim
 * ÜRETMEZ (idempotent). Bildirim KANALI (WhatsApp/uygulama-içi) bu turda
 * kapsam dışı bırakıldı — EPIC 1'in genel bildirim altyapısı henüz yok;
 * eskalasyon `slaEscalationLevel` alanında ve audit log'da görünür kalır.
 */
export async function checkMakeupSlaTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ checked: number; escalated: MakeupSlaEscalation[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "AI_AGENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const data = await readData();
  const now = new Date().toISOString();
  const escalated: MakeupSlaEscalation[] = [];

  for (const request of data.makeupRequests) {
    if (!request.slaDeadline) continue;
    const previousLevel = request.slaEscalationLevel ?? 0;
    const newLevel = resolveSlaEscalationLevel(request.slaDeadline, now);
    if (newLevel <= previousLevel) continue;

    await updateMakeupSlaEscalation(request.id, newLevel);
    audit(ctx, "makeup.sla_escalation", "MakeupRequest", request.id, {
      previousLevel,
      newLevel,
      slaDeadline: request.slaDeadline,
    });
    escalated.push({
      requestId: request.id,
      studentId: request.studentId,
      previousLevel,
      newLevel,
      slaDeadline: request.slaDeadline,
    });
  }

  return ok({ checked: data.makeupRequests.length, escalated });
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
  const auth = requireRole(ctx, [
    "SCHOOL_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT",
    "AI_AGENT",
    "SUPER_ADMIN",
  ]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);

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

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);

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
    audit(ctx, "payment.mark_paid", "Payment", v.data.paymentId);
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
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);
  if (!student) return fail("NOT_FOUND", "Student not found");

  let message: WaMessage | null = null;
  if (v.data.kind === "makeup_created") {
    const req = data.makeupRequests.find(
      (m) =>
        m.id === v.data.makeupRequestId ||
        (m.studentId === student.id &&
          (m.status === "pending" || m.status === "suggested" || m.status === "awaiting_info"))
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
    if (created) audit(ctx, "student.create", "Student", created.id);
    return ok({ studentId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createStudent failed");
  }
}

/**
 * Öğrencinin eğitim profilini günceller (EPIC 4): tür, kayıt dönemi,
 * seviye, hedef sınav, özel not. Öğrencinin temel iletişim/paket bilgilerini
 * değiştirmez — o alanlar için ayrı bir yol yok (mevcut kapsam dışı).
 */
export async function updateStudentProfileTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ studentId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateStudentProfileSchema, input);
  if (!v.ok) return v;

  try {
    const { studentId, ...patch } = v.data;
    await updateStudentProfile(studentId, patch);
    audit(ctx, "student.profile_update", "Student", studentId, patch);
    return ok({ studentId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateStudentProfile failed");
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

function mapFeeRuleErrorCode(
  code: "INVALID_RATE" | "INVALID_DATE_RANGE" | "OVERLAPPING_RULE" | "NOT_FOUND"
): ServiceErrorCode {
  if (code === "NOT_FOUND") return "NOT_FOUND";
  if (code === "OVERLAPPING_RULE") return "CONFLICT";
  return "VALIDATION_ERROR";
}

/** Öğretmen için yeni bir dakika-başı ücret kuralı ekler. */
export async function createFeeRuleTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ rule: TeacherFeeRule }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createFeeRuleSchema, input);
  if (!v.ok) return v;

  try {
    const result = await addTeacherFeeRule(v.data);
    if (!result.ok) return fail(mapFeeRuleErrorCode(result.code), result.message);
    audit(ctx, "teacher_fee.create", "TeacherFeeRule", result.rule.id, {
      teacherId: result.rule.teacherId,
      perMinuteRate: result.rule.perMinuteRate,
    });
    return ok({ rule: result.rule });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createFeeRule failed");
  }
}

/**
 * Mevcut bir ücret kuralını günceller. Geçmiş `TeacherPayout` snapshot'ları
 * bu güncellemeden asla etkilenmez — onlar oluşturuldukları andaki tutarı
 * kalıcı olarak korur.
 */
export async function updateFeeRuleTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ rule: TeacherFeeRule }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateFeeRuleSchema, input);
  if (!v.ok) return v;

  try {
    const { ruleId, ...patch } = v.data;
    const result = await updateTeacherFeeRule(ruleId, patch);
    if (!result.ok) return fail(mapFeeRuleErrorCode(result.code), result.message);
    audit(ctx, "teacher_fee.update", "TeacherFeeRule", result.rule.id, {
      teacherId: result.rule.teacherId,
      perMinuteRate: result.rule.perMinuteRate,
    });
    return ok({ rule: result.rule });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateFeeRule failed");
  }
}

/**
 * Bir öğretmenin verilen dönem için hakediş dökümünü hesaplar — hiçbir
 * kayıt yazmaz (yalnızca önizleme). Yalnızca `lesson.teacherId` ile
 * filtreler; `Teacher.branchId` ile ek filtre uygulamaz.
 */
export async function computeTeacherPayoutTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<TeacherEarningsResult>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(computeTeacherPayoutSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  if (!data.teachers.some((t) => t.id === v.data.teacherId)) {
    return fail("NOT_FOUND", "Öğretmen bulunamadı.");
  }

  const result = computeTeacherEarningsForPeriod(
    data,
    v.data.teacherId,
    v.data.periodStart,
    v.data.periodEnd
  );
  return ok(result);
}

/**
 * Bir dönem için hakediş snapshot'ı kalıcı olarak oluşturur. Eksik ücret
 * kurallı ders varsa veya bu öğretmen+dönem için zaten bir kayıt varsa
 * reddeder — sessizce 0 TL'lik veya yinelenen kayıt asla oluşturmaz.
 */
export async function createTeacherPayoutTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ payout: TeacherPayout }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createTeacherPayoutSchema, input);
  if (!v.ok) return v;

  try {
    const result = await createTeacherPayout(v.data.teacherId, v.data.periodStart, v.data.periodEnd);
    if (!result.ok) {
      const code = result.code === "MISSING_FEE_RULE" ? "VALIDATION_ERROR" : "CONFLICT";
      const details = result.code === "MISSING_FEE_RULE" ? result.missingFeeRuleLessonIds : undefined;
      return fail(code, result.message, details);
    }
    return ok({ payout: result.payout });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createTeacherPayout failed");
  }
}

/** Bekleyen bir hakedişi ödendi olarak işaretler. Tutarı asla değiştirmez. */
export async function markTeacherPayoutPaidTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ payout: TeacherPayout }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(markTeacherPayoutPaidSchema, input);
  if (!v.ok) return v;

  try {
    const result = await markTeacherPayoutPaid(v.data.payoutId, v.data.method);
    if (!result.ok) {
      const code = result.code === "NOT_FOUND" ? "NOT_FOUND" : "CONFLICT";
      return fail(code, result.message);
    }
    return ok({ payout: result.payout });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "markTeacherPayoutPaid failed");
  }
}

/**
 * Kurumun kesirli ders süresi → ödenecek dakika politikasını değiştirir
 * (EPIC 3). Yalnızca ileri yönlü etkilidir: zaten oluşturulmuş `TeacherPayout`
 * snapshot'larını asla yeniden hesaplamaz.
 */
export async function updateFeeRoundingModeTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ feeRoundingMode: FeeRoundingMode }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateFeeRoundingModeSchema, input);
  if (!v.ok) return v;

  try {
    const data = await updateFeeRoundingMode(v.data.feeRoundingMode);
    audit(ctx, "school.fee_rounding_mode.update", "School", ctx.tenantId, {
      feeRoundingMode: v.data.feeRoundingMode,
    });
    return ok({ feeRoundingMode: data.settings.feeRoundingMode });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateFeeRoundingMode failed");
  }
}

/**
 * EPIC 1 (IMPLEMENTATION_PLAN.md) — gecikmiş ödemeler için GERÇEK tenant
 * taraması: `findAvailableTeachers`'ın `{}` girdili tarama deseniyle aynı
 * (bkz. checkMakeupSlaTool). Sabit demo ID listesi TARAMAZ. Her gecikmiş
 * ödeme için: veli communicationOptOut ise atlar; sıklık limiti
 * (collectionsSettings.frequencyLimitDays, varsayılan 3 gün) henüz dolmadıysa
 * atlar; aksi halde upsertFollowUpCase ile taslak/onaylı vaka açar/günceller
 * ve veliye uygulama içi bildirim oluşturur. autoSendEnabled=true olsa bile
 * wa.me linkine tıklamak hâlâ bir insan eylemidir — bu ayar yalnızca
 * taslağın "approved" durumuna otomatik geçmesini sağlar, "sent" durumunu
 * ASLA otomatik üretmez (gerçek gönderim/okundu bilgisi olmadan uydurulmaz).
 */
export async function scanOverduePaymentsTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ scanned: number; casesUpserted: number; notificationsCreated: number }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "AI_AGENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  try {
    const data = await readData();
    const settings = data.settings.collectionsSettings ?? DEFAULT_COLLECTIONS_SETTINGS;
    const existingCases = await listFollowUpCases(ctx.tenantId);
    const now = new Date();

    let scanned = 0;
    let casesUpserted = 0;
    let notificationsCreated = 0;

    for (const payment of data.payments) {
      if (payment.status !== "overdue") continue;
      scanned++;

      const student = data.students.find((s) => s.id === payment.studentId);
      if (!student || student.communicationOptOut) continue;

      const openCase = existingCases.find(
        (c) => c.paymentId === payment.id && c.status !== "paid" && c.status !== "lost"
      );
      const lastContactAt = openCase?.sentAt ?? openCase?.updatedAt;
      if (lastContactAt) {
        const daysSinceContact = differenceInCalendarDays(now, parseISO(lastContactAt));
        if (daysSinceContact < settings.frequencyLimitDays) continue;
      }

      const remaining = Math.max(Number(payment.amount) - Number(payment.paidAmount), 0);
      const messageDraft = `Merhaba, ${student.name} için ${formatMoney(remaining)} tutarında gecikmiş ödeme kaydı bulunmaktadır. Size uygun ödeme planı için bizimle iletişime geçebilirsiniz.`;

      const nextCase = await upsertFollowUpCase({
        id: openCase?.id,
        tenantId: ctx.tenantId,
        paymentId: payment.id,
        studentId: student.id,
        status: settings.autoSendEnabled ? "approved" : "draft",
        messageDraft,
        attributedAmount: remaining,
        approvedBy: settings.autoSendEnabled ? ctx.userId : openCase?.approvedBy,
        approvedAt: settings.autoSendEnabled ? now.toISOString() : openCase?.approvedAt,
      });
      casesUpserted++;

      await createNotification({
        tenantId: ctx.tenantId,
        targetStudentId: student.id,
        kind: "payment_overdue",
        title: "Gecikmiş ödeme hatırlatması",
        body: `${payment.description} için ${formatMoney(remaining)} tutarında ödemeniz gecikmiştir.`,
      });
      notificationsCreated++;

      audit(ctx, "collections.reminder_scan", "PaymentFollowUpCase", nextCase.id, {
        paymentId: payment.id,
        studentId: student.id,
        autoSendEnabled: settings.autoSendEnabled,
      });
    }

    return ok({ scanned, casesUpserted, notificationsCreated });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "scanOverduePayments failed");
  }
}

/** EPIC 1 — veli kendi çocuğu için, admin/AI_AGENT herkes için değiştirebilir. */
export async function updateCommunicationPreferenceTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ studentId: string; communicationOptOut: boolean }>> {
  const v = parseOrFail(updateCommunicationPreferenceSchema, input);
  if (!v.ok) return v;

  const isOwnChild = ctx.role === "PARENT" && canAccessStudent(ctx, v.data.studentId);
  if (!isOwnChild) {
    const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "AI_AGENT"]);
    if (!auth.ok) return fail("FORBIDDEN", auth.message);
  }

  try {
    await updateStudentProfile(v.data.studentId, {
      communicationOptOut: v.data.communicationOptOut,
    });
    audit(ctx, "student.communication_preference_update", "Student", v.data.studentId, {
      communicationOptOut: v.data.communicationOptOut,
    });
    return ok(v.data);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "updateCommunicationPreference failed"
    );
  }
}

export async function updateCollectionsSettingsTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ collectionsSettings: CollectionsSettings }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateCollectionsSettingsSchema, input);
  if (!v.ok) return v;

  try {
    await updateCollectionsSettings(v.data);
    audit(ctx, "school.collections_settings_update", "School", ctx.tenantId, v.data);
    return ok({ collectionsSettings: v.data });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "updateCollectionsSettings failed"
    );
  }
}

/** Yalnızca çağıranın kendi bildirimleri (userId veya kendi studentId'si) — cross-user sızıntı yok. */
export async function listNotificationsTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ notifications: Notification[] }>> {
  try {
    const notifications = await listNotificationsForUser({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      studentId: ctx.studentId,
    });
    return ok({ notifications });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listNotifications failed");
  }
}

export async function markNotificationReadTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ notificationId: string }>> {
  const v = parseOrFail(markNotificationReadSchema, input);
  if (!v.ok) return v;

  try {
    const updated = await markNotificationRead(
      { tenantId: ctx.tenantId, userId: ctx.userId, studentId: ctx.studentId },
      v.data.notificationId
    );
    if (!updated) return fail("NOT_FOUND", "Bildirim bulunamadı");
    return ok({ notificationId: v.data.notificationId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "markNotificationRead failed");
  }
}

/** Yönetim ekranı: durum fark etmeksizin (draft/published/archived) tüm duyurular. */
export async function listAllAnnouncementsTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ announcements: Announcement[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  try {
    const announcements = await listAnnouncements(ctx.tenantId);
    return ok({ announcements });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listAllAnnouncements failed");
  }
}

export async function createAnnouncementTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ announcementId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createAnnouncementSchema, input);
  if (!v.ok) return v;

  try {
    const announcement = await createAnnouncement({
      tenantId: ctx.tenantId,
      title: v.data.title,
      body: v.data.body,
      attachmentUrl: v.data.attachmentUrl,
      audienceType: v.data.audienceType,
      audienceRef: v.data.audienceRef as AnnouncementAudienceRef | undefined,
      status: v.data.status,
      pinned: v.data.pinned,
      publishAt: v.data.publishAt,
      expireAt: v.data.expireAt,
      createdBy: ctx.userId,
    });
    audit(ctx, "announcement.create", "Announcement", announcement.id, {
      audienceType: v.data.audienceType,
      status: announcement.status,
    });
    return ok({ announcementId: announcement.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createAnnouncement failed");
  }
}

export async function updateAnnouncementStatusTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ announcementId: string; status: AnnouncementStatus }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateAnnouncementStatusSchema, input);
  if (!v.ok) return v;

  try {
    const updated = await updateAnnouncementStatus(ctx.tenantId, v.data.announcementId, v.data.status);
    if (!updated) return fail("NOT_FOUND", "Duyuru bulunamadı");
    audit(ctx, "announcement.status_update", "Announcement", v.data.announcementId, {
      status: v.data.status,
    });
    return ok({ announcementId: v.data.announcementId, status: v.data.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateAnnouncementStatus failed");
  }
}

/**
 * Portal görünümü: yalnızca çağıranın hedef kitlesinde olan, YAYINDA
 * (published + yayın penceresi içinde) duyurular — sunucu tarafında
 * filtrelenir (bkz. src/lib/announcements/audience.ts), asla hedef-dışı
 * duyuru client'a gönderilmez.
 */
export async function listAnnouncementsForUserTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ announcements: Announcement[] }>> {
  try {
    const [data, all] = await Promise.all([readData(), listAnnouncements(ctx.tenantId)]);
    const recipient = { role: ctx.role, userId: ctx.userId, teacherId: ctx.teacherId, studentId: ctx.studentId };
    const audienceContext = { students: data.students, teachers: data.teachers };
    const visible = all.filter(
      (a) => isVisibleNow(a) && matchesAudience(a, recipient, audienceContext)
    );
    return ok({ announcements: visible });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listAnnouncementsForUser failed");
  }
}

export async function markAnnouncementReadTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ announcementId: string }>> {
  const v = parseOrFail(markAnnouncementReadSchema, input);
  if (!v.ok) return v;

  try {
    await markAnnouncementRead(ctx.tenantId, v.data.announcementId, ctx.userId);
    return ok({ announcementId: v.data.announcementId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "markAnnouncementRead failed");
  }
}

/** Yönetim ekranı "kim okudu" tablosu. */
export async function listAnnouncementReadersTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ userIds: string[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ announcementId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    const userIds = await listReadUserIds(ctx.tenantId, v.data.announcementId);
    return ok({ userIds });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listAnnouncementReaders failed");
  }
}

/**
 * EPIC 7 (IMPLEMENTATION_PLAN.md) — TEACHER yalnızca kendi öğrencisi için
 * değerlendirme oluşturabilir (mevcut `canAccessStudent`'ın TEACHER için
 * "true, filtrelenir" kuralını burada somut olarak uyguluyoruz).
 * `teacherId` her zaman öğrencinin ATANMIŞ öğretmeninden alınır (istekten
 * değil) — SCHOOL_ADMIN başka bir öğretmen adına oluştursa bile kayıt doğru
 * öğretmene atfedilir.
 */
export async function createAssessmentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ assessmentId: string }>> {
  const auth = requireRole(ctx, ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createAssessmentSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);
  if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");
  const lesson = data.lessons.find((l) => l.id === v.data.lessonId);
  if (!lesson) return fail("NOT_FOUND", "Ders bulunamadı");
  if (lesson.studentId !== student.id) {
    return fail("VALIDATION_ERROR", "Seçilen ders bu öğrenciye ait değil.");
  }
  if (ctx.role === "TEACHER" && lesson.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi dersiniz için değerlendirme oluşturabilirsiniz.");
  }

  try {
    const assessment = await createAssessment({
      tenantId: ctx.tenantId,
      lessonId: v.data.lessonId,
      studentId: v.data.studentId,
      teacherId: student.teacherId,
      teknikBecerisi: v.data.teknikBecerisi,
      notaOkuma: v.data.notaOkuma,
      muzikalite: v.data.muzikalite,
      ritimDuyusu: v.data.ritimDuyusu,
      calismaDuzeni: v.data.calismaDuzeni,
      evOdeviTamamlama: v.data.evOdeviTamamlama,
      dersKatilimi: v.data.dersKatilimi,
      motivasyon: v.data.motivasyon,
      genelIlerleme: v.data.genelIlerleme,
      hedefeUlasma: v.data.hedefeUlasma,
      strengthNote: v.data.strengthNote,
      nextStepsNote: v.data.nextStepsNote,
      improvementNote: v.data.improvementNote,
      parentPrivateNote: v.data.parentPrivateNote,
      parentNoteVisibleToStudent: v.data.parentNoteVisibleToStudent,
      teacherSignedName: v.data.teacherSignedName,
    });
    audit(ctx, "assessment.create", "LessonAssessment", assessment.id, {
      studentId: v.data.studentId,
      lessonId: v.data.lessonId,
    });
    return ok({ assessmentId: assessment.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createAssessment failed");
  }
}

export async function listAssessmentsForStudentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ assessments: LessonAssessment[] }>> {
  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === v.data.studentId);
    const access = assertStudentAccess(ctx, student, v.data.studentId);
    if (!access.ok) return fail(access.code, access.message);

    const assessments = await listAssessmentsForStudent(ctx.tenantId, v.data.studentId);
    return ok({ assessments: assessments.map((a) => stripPrivateNoteForRecipient(a, ctx.role)) });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listAssessmentsForStudent failed");
  }
}

export async function getAssessmentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ assessment: LessonAssessment }>> {
  const v = parseOrFail(z.object({ assessmentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    const assessment = await getAssessment(ctx.tenantId, v.data.assessmentId);
    if (!assessment) return fail("NOT_FOUND", "Değerlendirme bulunamadı");
    const data = await readData();
    const student = data.students.find((s) => s.id === assessment.studentId);
    const access = assertStudentAccess(ctx, student, assessment.studentId);
    if (!access.ok) return fail(access.code, access.message);
    if (ctx.role === "TEACHER" && assessment.teacherId !== ctx.teacherId) {
      return fail("FORBIDDEN", "Bu kayda erişiminiz yok");
    }
    return ok({ assessment: stripPrivateNoteForRecipient(assessment, ctx.role) });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "getAssessment failed");
  }
}

/** 4 haftalık birleşik rapor: geçmiş değerlendirmeler + genel skor trendi. */
export async function getAssessmentReportTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ assessments: LessonAssessment[]; trend: AssessmentTrendPoint[] }>> {
  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === v.data.studentId);
    const access = assertStudentAccess(ctx, student, v.data.studentId);
    if (!access.ok) return fail(access.code, access.message);

    const assessments = await listAssessmentsForStudent(ctx.tenantId, v.data.studentId);
    const trend = computeTrend(assessments, 4);
    return ok({
      assessments: assessments.map((a) => stripPrivateNoteForRecipient(a, ctx.role)),
      trend,
    });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "getAssessmentReport failed");
  }
}

/**
 * EPIC 8 (IMPLEMENTATION_PLAN.md) — TEACHER yalnızca kendi dersini
 * başlatabilir/bitirebilir. Erken/geç başlatma toleransı bilinçli: planlanan
 * saatten ne kadar sapmış olursa olsun kabul edilir (bkz.
 * lesson-live-status.ts) — yalnızca dersin MEVCUT durumu geçişi engeller.
 */
export async function startLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ lessonId: string; status: string }>> {
  const auth = requireRole(ctx, ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(startLessonSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const lesson = data.lessons.find((l) => l.id === v.data.lessonId);
  if (!lesson) return fail("NOT_FOUND", "Ders bulunamadı");
  if (ctx.role === "TEACHER" && lesson.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi dersinizi başlatabilirsiniz.");
  }

  try {
    const result = await startLessonLive(v.data.lessonId);
    if (!result.ok) return fail("VALIDATION_ERROR", result.message);
    audit(ctx, "lesson.start", "Lesson", v.data.lessonId, {});
    return ok({ lessonId: v.data.lessonId, status: result.lesson.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "startLesson failed");
  }
}

export async function endLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ lessonId: string; status: string }>> {
  const auth = requireRole(ctx, ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(endLessonSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const lesson = data.lessons.find((l) => l.id === v.data.lessonId);
  if (!lesson) return fail("NOT_FOUND", "Ders bulunamadı");
  if (ctx.role === "TEACHER" && lesson.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi dersinizi bitirebilirsiniz.");
  }

  try {
    const result = await endLessonLive(v.data.lessonId);
    if (!result.ok) return fail("VALIDATION_ERROR", result.message);
    audit(ctx, "lesson.end", "Lesson", v.data.lessonId, {});
    return ok({ lessonId: v.data.lessonId, status: result.lesson.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "endLesson failed");
  }
}

/** Yalnızca SCHOOL_ADMIN/SUPER_ADMIN — zorunlu not, audit'e yazılır (EPIC 0). */
export async function correctLessonTimesTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ lessonId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(correctLessonTimesSchema, input);
  if (!v.ok) return v;

  try {
    const result = await correctLessonTimesLive(v.data.lessonId, {
      actualStartAt: v.data.actualStartAt,
      actualEndAt: v.data.actualEndAt,
      correctedBy: ctx.userId,
      note: v.data.note,
    });
    if (!result.ok) return fail("VALIDATION_ERROR", result.message);
    audit(ctx, "lesson.time_correction", "Lesson", v.data.lessonId, {
      actualStartAt: v.data.actualStartAt,
      actualEndAt: v.data.actualEndAt,
      note: v.data.note,
    });
    return ok({ lessonId: v.data.lessonId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "correctLessonTimes failed");
  }
}

/**
 * EPIC 9 (IMPLEMENTATION_PLAN.md) — TEACHER kendi müsaitliği için bir öneri
 * oluşturur; `Teacher.availability` bu çağrıyla DEĞİŞMEZ, yalnızca onay
 * bekleyen bir kayıt eklenir (bkz. reviewTeacherAvailabilityRequestTool).
 */
export async function proposeTeacherAvailabilityTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requestId: string }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.teacherId) return fail("FORBIDDEN", "Öğretmen kimliği bulunamadı.");

  const v = parseOrFail(proposeTeacherAvailabilitySchema, input);
  if (!v.ok) return v;

  try {
    const request = await createAvailabilityRequest({
      tenantId: ctx.tenantId,
      teacherId: ctx.teacherId,
      proposedAvailability: v.data.proposedAvailability,
      exceptions: v.data.exceptions,
    });
    audit(ctx, "teacher.availability_request.create", "TeacherAvailabilityRequest", request.id, {
      teacherId: ctx.teacherId,
    });
    return ok({ requestId: request.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "proposeTeacherAvailability failed");
  }
}

/**
 * Bir öğretmenin geçmiş/bekleyen müsaitlik önerileri. TEACHER yalnızca
 * kendi kayıtlarını görebilir; SCHOOL_ADMIN/SUPER_ADMIN herhangi birini
 * (onay ekranı için).
 */
export async function listTeacherAvailabilityRequestsTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requests: TeacherAvailabilityRequest[] }>> {
  const auth = requireRole(ctx, ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ teacherId: z.string().min(1) }), input);
  if (!v.ok) return v;

  if (ctx.role === "TEACHER" && v.data.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi müsaitlik önerilerinizi görebilirsiniz.");
  }

  try {
    const requests = await listAvailabilityRequestsForTeacher(ctx.tenantId, v.data.teacherId);
    return ok({ requests });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "listTeacherAvailabilityRequests failed"
    );
  }
}

/**
 * Yalnızca SCHOOL_ADMIN/SUPER_ADMIN — onaylanan öneri hemen
 * `Teacher.availability`'ye UYGULANIR (updateTeacherAvailability); reddedilen
 * öneri yalnızca durumu değiştirir, öğretmenin canlı programına dokunmaz.
 * Zaten incelenmiş (approved/rejected) bir öneriyi tekrar incelemek
 * NOT_FOUND döner (idempotent hata, EPIC 8'in aynı deseni).
 */
export async function reviewTeacherAvailabilityRequestTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ requestId: string; status: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(reviewTeacherAvailabilityRequestSchema, input);
  if (!v.ok) return v;

  try {
    const existing = await getAvailabilityRequest(ctx.tenantId, v.data.requestId);
    if (!existing) return fail("NOT_FOUND", "Müsaitlik önerisi bulunamadı.");

    const reviewed = await reviewAvailabilityRequest(ctx.tenantId, v.data.requestId, {
      status: v.data.decision,
      reviewNote: v.data.reviewNote,
      reviewedBy: ctx.userId,
    });
    if (!reviewed) {
      return fail("VALIDATION_ERROR", "Bu öneri zaten incelenmiş.");
    }

    if (reviewed.status === "approved") {
      await updateTeacherAvailability(reviewed.teacherId, reviewed.proposedAvailability);
    }

    audit(
      ctx,
      "teacher.availability_request.review",
      "TeacherAvailabilityRequest",
      reviewed.id,
      { decision: v.data.decision, reviewNote: v.data.reviewNote, teacherId: reviewed.teacherId }
    );
    return ok({ requestId: reviewed.id, status: reviewed.status });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "reviewTeacherAvailabilityRequest failed"
    );
  }
}

/** EPIC 6B (IMPLEMENTATION_PLAN.md) — TEACHER kendi öğrencisi için ödev oluşturur. */
export async function createHomeworkTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ homeworkId: string }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createHomeworkSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");
  if (student.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi öğrenciniz için ödev oluşturabilirsiniz.");
  }

  try {
    const homework = await createHomework({
      tenantId: ctx.tenantId,
      teacherId: ctx.teacherId!,
      studentId: v.data.studentId,
      title: v.data.title,
      description: v.data.description,
      dueDate: v.data.dueDate,
    });
    audit(ctx, "homework.create", "Homework", homework.id, { studentId: v.data.studentId });
    return ok({ homeworkId: homework.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createHomework failed");
  }
}

/** Öğrencinin kendi ödevleri — STUDENT/PARENT kendi çocuğu, TEACHER kendi öğrencisi, admin herkes. */
export async function listHomeworkForStudentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ homework: Homework[] }>> {
  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === v.data.studentId);
    const access = assertStudentAccess(ctx, student, v.data.studentId);
    if (!access.ok) return fail(access.code, access.message);

    const homework = await listHomeworkForStudent(ctx.tenantId, v.data.studentId);
    return ok({ homework });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listHomeworkForStudent failed");
  }
}

/** EPIC 6D — TEACHER kendi öğrencilerine verdiği ödevlerin listesi. */
export async function listHomeworkForTeacherTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ homework: Homework[] }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.teacherId) return fail("FORBIDDEN", "Öğretmen kimliği bulunamadı.");

  try {
    const homework = await listHomeworkForTeacher(ctx.tenantId, ctx.teacherId);
    return ok({ homework });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listHomeworkForTeacher failed");
  }
}

/**
 * EPIC 6B — STUDENT kendi ödevine teslim yükler (video/foto/dosya). Dosya
 * içeriği base64 — boyut sınırı submitHomeworkSchema'da (bkz. validation.ts).
 */
export async function submitHomeworkTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ submissionId: string }>> {
  const auth = requireRole(ctx, ["STUDENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.studentId) return fail("FORBIDDEN", "Öğrenci kimliği bulunamadı.");

  const v = parseOrFail(submitHomeworkSchema, input);
  if (!v.ok) return v;

  const homework = await getHomework(ctx.tenantId, v.data.homeworkId);
  if (!homework) return fail("NOT_FOUND", "Ödev bulunamadı");
  if (homework.studentId !== ctx.studentId) {
    return fail("FORBIDDEN", "Yalnızca kendi ödevinize teslim yükleyebilirsiniz.");
  }

  try {
    const submission = await submitHomework({
      tenantId: ctx.tenantId,
      homeworkId: v.data.homeworkId,
      studentId: ctx.studentId,
      note: v.data.note,
      fileName: v.data.fileName,
      fileMimeType: v.data.fileMimeType,
      fileData: v.data.fileData,
    });
    audit(ctx, "homework.submit", "HomeworkSubmission", submission.id, {
      homeworkId: v.data.homeworkId,
    });
    return ok({ submissionId: submission.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "submitHomework failed");
  }
}

/** `fileData` içermez (özet) — indirme için getHomeworkSubmissionFileTool kullanılmalı. */
export async function listHomeworkSubmissionsTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ submissions: HomeworkSubmission[] }>> {
  const v = parseOrFail(z.object({ homeworkId: z.string().min(1) }), input);
  if (!v.ok) return v;

  const homework = await getHomework(ctx.tenantId, v.data.homeworkId);
  if (!homework) return fail("NOT_FOUND", "Ödev bulunamadı");

  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === homework.studentId);
    const access = assertStudentAccess(ctx, student, homework.studentId);
    if (!access.ok) return fail(access.code, access.message);

    const submissions = await listSubmissionsForHomework(ctx.tenantId, v.data.homeworkId);
    return ok({ submissions });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listHomeworkSubmissions failed");
  }
}

/** EPIC 6D — TEACHER kendi öğrencisinin teslimine geri bildirim yazar. */
export async function reviewHomeworkSubmissionTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ submissionId: string }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(reviewHomeworkSubmissionSchema, input);
  if (!v.ok) return v;

  const submission = await getSubmission(ctx.tenantId, v.data.submissionId);
  if (!submission) return fail("NOT_FOUND", "Teslim bulunamadı");
  const homework = await getHomework(ctx.tenantId, submission.homeworkId);
  if (!homework || homework.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi öğrencinizin teslimine geri bildirim yazabilirsiniz.");
  }

  try {
    const reviewed = await reviewSubmission(ctx.tenantId, v.data.submissionId, v.data.teacherFeedback);
    if (!reviewed) return fail("NOT_FOUND", "Teslim bulunamadı");
    audit(ctx, "homework.review", "HomeworkSubmission", v.data.submissionId, {});
    return ok({ submissionId: v.data.submissionId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "reviewHomeworkSubmission failed");
  }
}

/**
 * Dosya indirme rotası için — yalnızca sahiplik kontrolü geçen çağrılar
 * `fileData`yı görür, asla ham/tahmin edilebilir bir URL üzerinden değil.
 */
export async function getHomeworkSubmissionFileTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ fileName?: string; fileMimeType?: string; fileData?: string }>> {
  const v = parseOrFail(z.object({ submissionId: z.string().min(1) }), input);
  if (!v.ok) return v;

  const submission = await getSubmission(ctx.tenantId, v.data.submissionId);
  if (!submission) return fail("NOT_FOUND", "Teslim bulunamadı");

  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === submission.studentId);
    const access = assertStudentAccess(ctx, student, submission.studentId);
    if (!access.ok) return fail(access.code, access.message);
    if (!submission.fileData) return fail("NOT_FOUND", "Bu teslimde dosya yok");

    return ok({
      fileName: submission.fileName,
      fileMimeType: submission.fileMimeType,
      fileData: submission.fileData,
    });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "getHomeworkSubmissionFile failed");
  }
}

/** EPIC 6B — TEACHER kendi öğrencilerine materyal/pratik videosu paylaşır. */
export async function createTeachingMaterialTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ materialId: string }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.teacherId) return fail("FORBIDDEN", "Öğretmen kimliği bulunamadı.");

  const v = parseOrFail(createTeachingMaterialSchema, input);
  if (!v.ok) return v;

  try {
    const material = await createTeachingMaterial({
      tenantId: ctx.tenantId,
      teacherId: ctx.teacherId,
      title: v.data.title,
      description: v.data.description,
      targetStudentType: v.data.targetStudentType,
      targetInstrument: v.data.targetInstrument,
      targetLevel: v.data.targetLevel,
      fileName: v.data.fileName,
      fileMimeType: v.data.fileMimeType,
      fileData: v.data.fileData,
    });
    audit(ctx, "teaching_material.create", "TeachingMaterial", material.id, {});
    return ok({ materialId: material.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createTeachingMaterial failed");
  }
}

/**
 * Bir öğrencinin görebileceği materyaller — yalnızca KENDİ öğretmeninin
 * paylaştığı VE hedefleme kriterlerine uyan materyaller (bkz.
 * matchesMaterialAudience). `fileData` içermez (özet) — indirme için
 * getTeachingMaterialFileTool kullanılmalı.
 */
export async function listTeachingMaterialsForStudentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ materials: TeachingMaterial[] }>> {
  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === v.data.studentId);
    const access = assertStudentAccess(ctx, student, v.data.studentId);
    if (!access.ok) return fail(access.code, access.message);
    if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");

    const all = await listTeachingMaterialsForTeacher(ctx.tenantId, student.teacherId);
    const materials = all.filter((m) => matchesMaterialAudience(m, student));
    return ok({ materials });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "listTeachingMaterialsForStudent failed"
    );
  }
}

/** EPIC 6D — TEACHER kendi paylaştığı materyallerin listesi. */
export async function listTeachingMaterialsForTeacherTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ materials: TeachingMaterial[] }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.teacherId) return fail("FORBIDDEN", "Öğretmen kimliği bulunamadı.");

  try {
    const materials = await listTeachingMaterialsForTeacher(ctx.tenantId, ctx.teacherId);
    return ok({ materials });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "listTeachingMaterialsForTeacher failed"
    );
  }
}

/** Dosya indirme rotası için — hedefleme + sahiplik kontrolü burada yapılır. */
export async function getTeachingMaterialFileTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ fileName?: string; fileMimeType?: string; fileData?: string }>> {
  const v = parseOrFail(z.object({ materialId: z.string().min(1) }), input);
  if (!v.ok) return v;

  const material = await getTeachingMaterial(ctx.tenantId, v.data.materialId);
  if (!material) return fail("NOT_FOUND", "Materyal bulunamadı");

  if (ctx.role === "TEACHER") {
    if (material.teacherId !== ctx.teacherId) return fail("FORBIDDEN", "Bu materyale erişiminiz yok");
  } else if (ctx.role === "PARENT" || ctx.role === "STUDENT") {
    if (!ctx.studentId) return fail("FORBIDDEN", "Bu materyale erişiminiz yok");
    const data = await readData();
    const student = data.students.find((s) => s.id === ctx.studentId);
    if (
      !student ||
      student.teacherId !== material.teacherId ||
      !matchesMaterialAudience(material, student)
    ) {
      return fail("FORBIDDEN", "Bu materyale erişiminiz yok");
    }
  } else if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "SCHOOL_ADMIN" && ctx.role !== "AI_AGENT") {
    return fail("FORBIDDEN", "Bu materyale erişiminiz yok");
  }

  if (!material.fileData) return fail("NOT_FOUND", "Bu materyalde dosya yok");
  return ok({
    fileName: material.fileName,
    fileMimeType: material.fileMimeType,
    fileData: material.fileData,
  });
}

/**
 * EPIC 6C (IMPLEMENTATION_PLAN.md) — PARENT/STUDENT kendi çocuğu/kendisi
 * için öğretmen hakkında yapılandırılmış geri bildirim gönderir. Kamuya
 * açık ortalama/sıralama asla oluşturulmaz (bkz. teacher-feedback.ts).
 */
export async function submitTeacherFeedbackTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ feedbackId: string }>> {
  const auth = requireRole(ctx, ["PARENT", "STUDENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(submitTeacherFeedbackSchema, input);
  if (!v.ok) return v;

  if (ctx.studentId !== v.data.studentId) {
    return fail("FORBIDDEN", "Yalnızca kendi çocuğunuz/kendiniz için geri bildirim gönderebilirsiniz.");
  }

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");

  try {
    const feedback = await submitTeacherFeedback({
      tenantId: ctx.tenantId,
      teacherId: student.teacherId,
      studentId: v.data.studentId,
      submittedBy: ctx.userId,
      submitterRole: ctx.role,
      scores: v.data.scores,
      comment: v.data.comment,
    });
    audit(ctx, "teacher_feedback.submit", "TeacherFeedback", feedback.id, {
      teacherId: student.teacherId,
    });
    return ok({ feedbackId: feedback.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "submitTeacherFeedback failed");
  }
}

/**
 * Yalnızca SCHOOL_ADMIN/SUPER_ADMIN görebilir — öğretmenin KENDİ geri
 * bildirimini görebileceği bir yol bilerek YAZILMADI (bkz. teacher-feedback.ts).
 */
export async function listTeacherFeedbackTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ feedback: TeacherFeedback[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ teacherId: z.string().min(1).optional() }), input);
  if (!v.ok) return v;

  try {
    const feedback = await listTeacherFeedback(ctx.tenantId, v.data.teacherId);
    return ok({ feedback });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listTeacherFeedback failed");
  }
}

export async function resetDemoTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ reset: true }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  try {
    await resetData();
    // Tahsilat takip vakaları ve bildirimler AppData'nın dışında ayrı
    // store'larda tutulur; demo sıfırlamasının tekrarlanabilir olması için
    // onları da temizle.
    await clearFollowUpCases(ctx.tenantId);
    await clearNotifications(ctx.tenantId);
    await clearAnnouncements(ctx.tenantId);
    await clearAssessments(ctx.tenantId);
    await clearAvailabilityRequests(ctx.tenantId);
    await clearHomework(ctx.tenantId);
    await clearTeachingMaterials(ctx.tenantId);
    await clearTeacherFeedback(ctx.tenantId);
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
