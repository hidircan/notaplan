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
  updateRoom,
  archiveTeacher,
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
  updateTeacherInstruments,
  updateTeacherFeeRule,
  switchLessonOpsFlagLive,
  upsertMonthlyPlanPayment,
  addPackage,
  updatePackage,
} from "../store";
import { setClosedDay, listClosedDays } from "../closed-day-overrides";
import { resolveDayStatus, isWeeklyClosedDayForTerm } from "../attendance-calendar";
import {
  setSocialMediaConsent,
  getLatestSocialMediaConsent,
} from "../social-media-consent";
import {
  createInstrumentCatalogEntry,
  updateInstrumentCatalogEntry,
  listInstrumentCatalog,
  resolveActiveInstrumentNames,
} from "../instrument-catalog";
import { effectiveLessonOpsStatus } from "../lesson-ops";
import { computeTeacherEarningsForPeriod, type TeacherEarningsResult } from "../teacher-payout";
import {
  suggestMakeupSlots,
  resolveSlaEscalationLevel,
  type MakeupSlaEscalation,
} from "../makeup-engine";
import { suggestLessonSlots, type LessonSlotSuggestion } from "../lesson-scheduling";
import { DEFAULT_LESSON_DURATION_MINUTES } from "../lesson-duration";
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
  findTeacherFeedbackThisMonth,
  getTeacherFeedbackById,
  updateTeacherFeedbackStatus,
  setTeacherFeedbackShared,
  computeTeacherFeedbackSummary,
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
  createCurriculumTopicSchema,
  updateCurriculumTopicSchema,
  createTrialLessonSchema,
  updateTrialLessonStatusSchema,
  archiveStudentSchema,
  archiveTeacherSchema,
  updateRoomSchema,
  setNationalIdSchema,
  createDocumentInstanceSchema,
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
  updateTeacherInstrumentsSchema,
  createPackageSchema,
  updatePackageSchema,
  socialMediaConsentSchema,
  createInstrumentCatalogSchema,
  updateInstrumentCatalogSchema,
} from "../validation";
import {
  DEFAULT_COLLECTIONS_SETTINGS,
  INSTRUMENTS,
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
import {
  createCurriculumTopic,
  updateCurriculumTopic,
  listCurriculumTopicsForStudent,
  computeOverallCurriculumProgress,
  toCurriculumSummary,
  getCurriculumTopic,
} from "../curriculum";
import type { StudentCurriculumTopic, DocumentInstance, TeacherFeedbackStatus } from "../types";
import { createTrialLesson, listTrialLessons, updateTrialLessonStatus, getTrialLesson } from "../trial-lessons";
import {
  listTemplates,
  getTemplate,
  createDocumentInstance,
  markDocumentPrinted,
  listDocumentsForStudent,
  listDocumentInstances,
  archiveDocumentInstance,
  uploadSignedDocumentFile,
  type DocumentInstanceFilters,
} from "../documents";
import { encryptNationalId, maskNationalId, canViewFullNationalId } from "../pii";
import { assertSchedulableDate } from "../lesson-scheduling";
import { resolveCollectionsIban } from "../collections-due";


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

export type FindPersonScheduleResult =
  | { matchType: "none"; query: string }
  | {
      matchType: "ambiguous";
      query: string;
      candidates: Array<{ kind: "student" | "teacher"; id: string; name: string }>;
    }
  | {
      matchType: "student" | "teacher";
      id: string;
      name: string;
      upcomingLessons: unknown[];
    };

/**
 * Free-text name → schedule. TEACHER only matches own students (ownership via
 * canAccessStudent + teacherId) and self among teachers.
 */
export async function findPersonScheduleTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<FindPersonScheduleResult>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "PARENT", "AI_AGENT", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ query: z.string().min(1).max(120) }), input);
  if (!v.ok) return v;

  const needle = v.data.query.trim().toLocaleLowerCase("tr");
  if (!needle) return fail("VALIDATION_ERROR", "query boş olamaz");

  const data = await readData();
  const students = data.students.filter(
    (s) =>
      s.active &&
      s.name.toLocaleLowerCase("tr").includes(needle) &&
      canAccessStudent(ctx, s.id, { teacherId: s.teacherId })
  );
  const teachers = data.teachers.filter(
    (t) => t.active && t.name.toLocaleLowerCase("tr").includes(needle) && canAccessTeacher(ctx, t.id)
  );

  const total = students.length + teachers.length;
  if (total === 0) return ok({ matchType: "none", query: v.data.query });

  if (total > 1) {
    return ok({
      matchType: "ambiguous",
      query: v.data.query,
      candidates: [
        ...students.map((s) => ({ kind: "student" as const, id: s.id, name: s.name })),
        ...teachers.map((t) => ({ kind: "teacher" as const, id: t.id, name: t.name })),
      ].slice(0, 8),
    });
  }

  const now = Date.now();
  if (students.length === 1) {
    const s = students[0];
    const upcomingLessons = data.lessons
      .filter((l) => l.studentId === s.id && l.status === "scheduled" && new Date(l.startAt).getTime() >= now)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 5);
    return ok({ matchType: "student", id: s.id, name: s.name, upcomingLessons });
  }

  const t = teachers[0];
  const upcomingLessons = data.lessons
    .filter((l) => l.teacherId === t.id && l.status === "scheduled" && new Date(l.startAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5);
  return ok({ matchType: "teacher", id: t.id, name: t.name, upcomingLessons });
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
      lessonDurationMinutes: v.data.lessonDurationMinutes as Student["lessonDurationMinutes"],
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
    // ÖNCELİK 4 (devam) — çoklu enstrüman verilmişse `instruments` bundan
    // türetilir (benzersiz enstrüman listesi); yoksa legacy tek-enstrüman
    // davranışı ([instrument]) aynen korunur.
    const instruments =
      v.data.instrumentLevels && v.data.instrumentLevels.length > 0
        ? Array.from(new Set(v.data.instrumentLevels.map((r) => r.instrument as Instrument)))
        : [v.data.instrument as Instrument];

    const before = await readData();
    const ids = new Set(before.teachers.map((t) => t.id));
    await addTeacher({
      name: v.data.name,
      email: v.data.email ?? "",
      phone: v.data.phone,
      branchId: v.data.branchId as BranchId,
      instruments,
      instrumentLevels: v.data.instrumentLevels as Teacher["instrumentLevels"],
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
    if (created) audit(ctx, "teacher.create", "Teacher", created.id, { instrumentCount: instruments.length });
    return ok({ teacherId: created?.id ?? "unknown" });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createTeacher failed");
  }
}

/** ÖNCELİK 4 (devam) — öğretmen çoklu enstrüman+seviye düzenleme (admin only). */
export async function updateTeacherInstrumentsTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ teacherId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateTeacherInstrumentsSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  if (!data.teachers.some((t) => t.id === v.data.teacherId)) return fail("NOT_FOUND", "Öğretmen bulunamadı");

  try {
    const instruments = Array.from(new Set(v.data.instrumentLevels.map((r) => r.instrument as Instrument)));
    const updated = await updateTeacherInstruments(
      v.data.teacherId,
      instruments,
      v.data.instrumentLevels as Teacher["instrumentLevels"]
    );
    if (!updated) return fail("NOT_FOUND", "Öğretmen bulunamadı");
    audit(ctx, "teacher.instruments_update", "Teacher", v.data.teacherId, { instrumentCount: instruments.length });
    return ok({ teacherId: v.data.teacherId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateTeacherInstruments failed");
  }
}

/** ÖNCELİK 4 (devam) — Paket Yönetimi: yeni paket (admin only, tenant-scoped, audit'li). */
/**
 * ÖNCELİK 4 (devam) — Yönetilebilir Enstrüman Kataloğu. Salt okuma tüm
 * personel rollerine açık (ders planlama/formlar bunu okuyabilmeli); yazma
 * (ekleme/düzenleme/pasife alma) yalnız SCHOOL_ADMIN/SUPER_ADMIN.
 */
export async function listInstrumentCatalogTool(
  ctx: ServiceContext,
  _input: unknown
): Promise<ServiceResult<{ entries: import("../types").InstrumentCatalogEntry[]; staticInstruments: string[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN", "AI_AGENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const entries = await listInstrumentCatalog(ctx.tenantId);
  return ok({ entries, staticInstruments: [...INSTRUMENTS] });
}

export async function createInstrumentCatalogTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ entryId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createInstrumentCatalogSchema, input);
  if (!v.ok) return v;

  const result = await createInstrumentCatalogEntry({ tenantId: ctx.tenantId, name: v.data.name, createdBy: ctx.userId });
  if (!result.ok) return fail("VALIDATION_ERROR", result.message);
  audit(ctx, "instrument.create", "InstrumentCatalogEntry", result.entry.id, { name: result.entry.name });
  return ok({ entryId: result.entry.id });
}

export async function updateInstrumentCatalogTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ entryId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateInstrumentCatalogSchema, input);
  if (!v.ok) return v;

  const result = await updateInstrumentCatalogEntry(ctx.tenantId, v.data.entryId, {
    name: v.data.name,
    status: v.data.status,
  });
  if (!result.ok) return fail("VALIDATION_ERROR", result.message);
  audit(ctx, "instrument.update", "InstrumentCatalogEntry", v.data.entryId, {
    name: v.data.name,
    status: v.data.status,
  });
  return ok({ entryId: v.data.entryId });
}

export async function createPackageTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ packageId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(createPackageSchema, input);
  if (!v.ok) return v;

  const result = await addPackage({ ...v.data, createdBy: ctx.userId });
  if (!result.ok) return fail("VALIDATION_ERROR", result.message);
  audit(ctx, "package.create", "Package", result.pkg.id, { title: result.pkg.title });
  return ok({ packageId: result.pkg.id });
}

/**
 * ÖNCELİK 4 (devam) — Paket Yönetimi: fiyat/açıklama/durum güncelleme
 * (arşivleme dahil, `status:"archived"`). Hard delete YOK. GEÇMİŞ Payment
 * kayıtlarına dokunmaz — Package sadece ileriye dönük referans/görüntüleme
 * amaçlıdır (bkz. src/lib/packages.ts dokümantasyonu).
 */
export async function updatePackageTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ packageId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updatePackageSchema, input);
  if (!v.ok) return v;

  const { packageId, ...patch } = v.data;
  const result = await updatePackage(packageId, patch);
  if (!result.ok) return fail("VALIDATION_ERROR", result.message);
  audit(ctx, "package.update", "Package", packageId, patch);
  return ok({ packageId });
}

/**
 * ÖNCELİK 4 (devam) — Sosyal medya izni set etme (admin only, audit'li,
 * mevcut SocialMediaConsent modelinden — bkz. social-media-consent.ts).
 * Her çağrı yeni bir tarihçe satırı ekler; öğrenci/veli/öğretmen bu izni
 * göremez/değiştiremez (yalnızca admin RBAC).
 */
export async function setSocialMediaConsentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ studentId: string; status: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(socialMediaConsentSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  if (!data.students.some((s) => s.id === v.data.studentId)) return fail("NOT_FOUND", "Öğrenci bulunamadı");

  const record = await setSocialMediaConsent({ ...v.data, tenantId: ctx.tenantId, actorUserId: ctx.userId });
  audit(ctx, "student.social_media_consent", "Student", v.data.studentId, { status: record.status });
  return ok({ studentId: v.data.studentId, status: record.status });
}

/** Öğrenci detayında gösterim için en güncel izin — staff erişimi (RBAC mevcut assertStudentAccess ile aynı desen). */
export async function getSocialMediaConsentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ consent: Awaited<ReturnType<typeof getLatestSocialMediaConsent>> }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);

  const consent = await getLatestSocialMediaConsent(ctx.tenantId, v.data.studentId);
  return ok({ consent });
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
  const activeInstrumentNames = await resolveActiveInstrumentNames(ctx.tenantId);
  return ok(validateTeacherRows(data, csvRecords(v.data.csvText), activeInstrumentNames));
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
  const activeInstrumentNames = await resolveActiveInstrumentNames(ctx.tenantId);
  const preview = validateTeacherRows(data, csvRecords(v.data.csvText), activeInstrumentNames);
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
  const activeInstrumentNames = await resolveActiveInstrumentNames(ctx.tenantId);
  return ok(validateStudentRows(data, csvRecords(v.data.csvText), activeInstrumentNames));
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
  const activeInstrumentNames = await resolveActiveInstrumentNames(ctx.tenantId);
  const preview = validateStudentRows(data, csvRecords(v.data.csvText), activeInstrumentNames);
  if (preview.errorCount > 0) {
    return fail("VALIDATION_ERROR", "CSV içinde hatalı satır var; hiçbir kayıt eklenmedi.", preview.errors);
  }
  if (preview.valid.length === 0) return fail("VALIDATION_ERROR", "İçe aktarılacak geçerli satır yok.");
  try {
    const result = await importStudents(preview.valid);
    // ÖNCELİK 4 (devam) — sosyal medya izni Student modelinin dışında,
    // mevcut SocialMediaConsent modeliyle tutulur; import satırında
    // belirtilmişse (Evet/Hayır) commit sonrası, oluşturulan/güncellenen
    // öğrenciyle telefon numarasından eşleştirilerek yazılır.
    for (const row of preview.valid) {
      if (!row.socialMediaConsentStatus) continue;
      const student = result.data.students.find((s) => s.phone.trim() === row.phone.trim());
      if (!student) continue;
      await setSocialMediaConsent({
        tenantId: ctx.tenantId,
        studentId: student.id,
        status: row.socialMediaConsentStatus,
        representativeName: row.parentName,
        relationship: "Veli",
        scopes: row.socialMediaConsentStatus === "granted" ? ["photo", "video", "name"] : ["name"],
        actorUserId: ctx.userId,
      });
    }
    audit(ctx, "student.csv_import", "Student", "bulk", {
      created: result.created,
      updated: result.updated,
    });
    return ok(result);
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
  // ÖNCELİK 4 (devam) — dönem seçiliyse (Program ekranından geliyorsa) o
  // dönemin haftalık kapalı gün kuralı uygulanır (Güz: Pazartesi, Yaz:
  // Cts/Paz); term verilmemişse LEGACY davranış (yalnızca Pazartesi) korunur.
  if (isWeeklyClosedDayForTerm(new Date(v.data.startAt), v.data.term)) {
    return fail(
      "VALIDATION_ERROR",
      v.data.term
        ? `${v.data.term === "yaz" ? "Cumartesi/Pazar" : "Pazartesi"} bu dönemde okul kapalıdır — bu gün için ders planlanamaz.`
        : "Pazartesi okul kapalıdır — bu gün için ders planlanamaz."
    );
  }

  try {
    const before = await readData();
    const ids = new Set(before.lessons.map((l) => l.id));
    await addLesson({
      studentId: v.data.studentId,
      teacherId: v.data.teacherId,
      roomId: v.data.roomId,
      instrument: v.data.instrument as Instrument,
      startAt: v.data.startAt,
      durationMinutes: v.data.durationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
      term: v.data.term,
      academicYearStart: v.data.academicYearStart,
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
  if (v.data.startAt) {
    // ÖNCELİK 4 (devam) — taşınan dersin KENDİ dönem etiketi esas alınır
    // (varsa); yoksa legacy (yalnızca Pazartesi) davranış korunur.
    const existing = (await readData()).lessons.find((l) => l.id === v.data.lessonId);
    if (isWeeklyClosedDayForTerm(new Date(v.data.startAt), existing?.term)) {
      return fail(
        "VALIDATION_ERROR",
        existing?.term
          ? `${existing.term === "yaz" ? "Cumartesi/Pazar" : "Pazartesi"} bu dönemde okul kapalıdır — ders bu güne taşınamaz.`
          : "Pazartesi okul kapalıdır — ders bu güne taşınamaz."
      );
    }
  }

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
    durationMinutes: v.data.durationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
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
): Promise<ServiceResult<{ feedbackId: string; updated: boolean }>> {
  const auth = requireRole(ctx, ["PARENT", "STUDENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(submitTeacherFeedbackSchema, input);
  if (!v.ok) return v;

  // Fail-closed: ctx.studentId eksikse (beklenmez ama) hiçbir öğrenciye eşleşmez.
  if (!ctx.studentId || ctx.studentId !== v.data.studentId) {
    return fail("FORBIDDEN", "Yalnızca kendi çocuğunuz/kendiniz için geri bildirim gönderebilirsiniz.");
  }

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");

  try {
    const { feedback, updated } = await submitTeacherFeedback({
      tenantId: ctx.tenantId,
      teacherId: student.teacherId,
      studentId: v.data.studentId,
      submittedBy: ctx.userId,
      submitterRole: ctx.role,
      scores: v.data.scores,
      continueWithTeacher: v.data.continueWithTeacher,
      comment: v.data.comment,
    });
    audit(ctx, updated ? "teacher_feedback.update" : "teacher_feedback.submit", "TeacherFeedback", feedback.id, {
      teacherId: student.teacherId,
    });
    return ok({ feedbackId: feedback.id, updated });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "submitTeacherFeedback failed");
  }
}

/**
 * Öğrencinin bu öğretmen için cari ayda zaten bir kaydı olup olmadığı —
 * formun "Değerlendir" mi "Değerlendirmeyi Güncelle" mi göstereceğine karar
 * verir. Yalnızca kendi kaydını görebilir (ham veri, ama yalnız kendisininki).
 */
export async function getOwnTeacherFeedbackThisMonthTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ feedback: TeacherFeedback | null }>> {
  const auth = requireRole(ctx, ["PARENT", "STUDENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ studentId: z.string().min(1), teacherId: z.string().min(1) }), input);
  if (!v.ok) return v;

  if (!ctx.studentId || ctx.studentId !== v.data.studentId) {
    return fail("FORBIDDEN", "Yalnızca kendi çocuğunuz/kendiniz için geri bildirim görüntüleyebilirsiniz.");
  }

  try {
    const feedback = await findTeacherFeedbackThisMonth(ctx.tenantId, v.data.studentId, v.data.teacherId);
    return ok({ feedback });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "getOwnTeacherFeedback failed");
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

export type MaskedTeacherFeedback = Omit<TeacherFeedback, "studentId" | "submittedBy">;

const feedbackReviewFiltersSchema = z.object({
  teacherId: z.string().min(1).optional(),
  status: z.enum(["pending", "reviewed", "actioned", "archived"]).optional(),
  sourceType: z.enum(["STUDENT", "PARENT"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * Yönetici inceleme ekranının ana veri kaynağı — ham öğrenci kimliği
 * (studentId/submittedBy) VARSAYILAN OLARAK maskelenir. Kimlik yalnızca
 * `revealTeacherFeedbackIdentityTool` ile, gerekçeli ve audit'li biçimde
 * açılabilir.
 */
export async function listTeacherFeedbackForReviewTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ feedback: MaskedTeacherFeedback[] }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(feedbackReviewFiltersSchema, input);
  if (!v.ok) return v;

  try {
    const all = await listTeacherFeedback(ctx.tenantId, v.data.teacherId);
    const filtered = all.filter((f) => {
      if (v.data.status && f.status !== v.data.status) return false;
      if (v.data.sourceType && f.submitterRole !== v.data.sourceType) return false;
      if (v.data.from && f.createdAt < v.data.from) return false;
      if (v.data.to && f.createdAt > v.data.to) return false;
      return true;
    });
    const masked = filtered.map(({ studentId: _s, submittedBy: _b, ...rest }) => {
      void _s;
      void _b;
      return rest;
    });
    return ok({ feedback: masked });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listTeacherFeedbackForReview failed");
  }
}

const revealTeacherFeedbackIdentitySchema = z.object({
  feedbackId: z.string().min(1),
  reason: z.string().min(5, "Gerekçe en az 5 karakter olmalı").max(500),
});

/**
 * Ham öğrenci kimliğini açar — yalnızca gerekçeli ve audit'li. Her çağrı
 * `teacher_feedback.reveal_identity` olarak, gerekçe metniyle birlikte
 * denetim kaydına yazılır.
 */
export async function revealTeacherFeedbackIdentityTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ studentId: string; studentName: string; submittedBy: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(revealTeacherFeedbackIdentitySchema, input);
  if (!v.ok) return v;

  try {
    const feedback = await getTeacherFeedbackById(ctx.tenantId, v.data.feedbackId);
    if (!feedback) return fail("NOT_FOUND", "Geri bildirim bulunamadı");

    const data = await readData();
    const student = data.students.find((s) => s.id === feedback.studentId);

    audit(ctx, "teacher_feedback.reveal_identity", "TeacherFeedback", feedback.id, {
      reason: v.data.reason,
    });

    return ok({
      studentId: feedback.studentId,
      studentName: student?.name ?? "Bilinmeyen öğrenci",
      submittedBy: feedback.submittedBy,
    });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "revealTeacherFeedbackIdentity failed");
  }
}

/** Yönetici durum yönetimi: İncelendi / Aksiyon Alındı / Arşivlendi. */
export async function updateTeacherFeedbackStatusTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ feedbackId: string; status: TeacherFeedbackStatus }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({ feedbackId: z.string().min(1), status: z.enum(["pending", "reviewed", "actioned", "archived"]) }),
    input
  );
  if (!v.ok) return v;

  try {
    const feedback = await updateTeacherFeedbackStatus(ctx.tenantId, v.data.feedbackId, v.data.status);
    if (!feedback) return fail("NOT_FOUND", "Geri bildirim bulunamadı");
    audit(ctx, "teacher_feedback.status_change", "TeacherFeedback", feedback.id, { status: v.data.status });
    return ok({ feedbackId: feedback.id, status: feedback.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateTeacherFeedbackStatus failed");
  }
}

/** Yönetici bir yorumu öğretmenin anonim özetinde paylaşmayı seçer/geri alır. */
export async function setTeacherFeedbackSharedTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ feedbackId: string; sharedWithTeacher: boolean }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(z.object({ feedbackId: z.string().min(1), shared: z.boolean() }), input);
  if (!v.ok) return v;

  try {
    const feedback = await setTeacherFeedbackShared(ctx.tenantId, v.data.feedbackId, v.data.shared);
    if (!feedback) return fail("NOT_FOUND", "Geri bildirim bulunamadı");
    audit(ctx, "teacher_feedback.set_shared", "TeacherFeedback", feedback.id, { shared: v.data.shared });
    return ok({ feedbackId: feedback.id, sharedWithTeacher: feedback.sharedWithTeacher });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "setTeacherFeedbackShared failed");
  }
}

/**
 * Öğretmenin GÖREBİLECEĞİ TEK yol — yalnızca kendi (ctx.teacherId) özeti,
 * yalnızca eşik sağlanınca (bkz. TEACHER_FEEDBACK_MIN_ANONYMOUS_RESPONSES),
 * hiçbir ham kayıt/kimlik asla dönmez.
 */
export async function getOwnTeacherFeedbackSummaryTool(
  ctx: ServiceContext
): Promise<ServiceResult<Awaited<ReturnType<typeof computeTeacherFeedbackSummary>>>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.teacherId) return fail("FORBIDDEN", "Öğretmen kaydı bulunamadı");

  try {
    const summary = await computeTeacherFeedbackSummary(ctx.tenantId, ctx.teacherId);
    return ok(summary);
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "getOwnTeacherFeedbackSummary failed");
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

/** TEACHER kendi öğrencisine müfredat konusu ekler. */
export async function createCurriculumTopicTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ topicId: string }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.teacherId) return fail("FORBIDDEN", "Öğretmen kimliği bulunamadı.");

  const v = parseOrFail(createCurriculumTopicSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);

  try {
    const topic = await createCurriculumTopic({
      tenantId: ctx.tenantId,
      studentId: v.data.studentId,
      teacherId: ctx.teacherId,
      title: v.data.title,
      description: v.data.description,
      status: v.data.status,
      progressPercent: v.data.progressPercent,
      sortOrder: v.data.sortOrder,
      notes: v.data.notes,
      createdBy: ctx.userId,
    });
    audit(ctx, "curriculum.create", "StudentCurriculumTopic", topic.id, {
      studentId: v.data.studentId,
    });
    return ok({ topicId: topic.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createCurriculumTopic failed");
  }
}

/** TEACHER kendi öğrencisinin konusunu günceller. */
export async function updateCurriculumTopicTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ topicId: string }>> {
  const auth = requireRole(ctx, ["TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!ctx.teacherId) return fail("FORBIDDEN", "Öğretmen kimliği bulunamadı.");

  const v = parseOrFail(updateCurriculumTopicSchema, input);
  if (!v.ok) return v;

  const existing = await getCurriculumTopic(ctx.tenantId, v.data.topicId);
  if (!existing) return fail("NOT_FOUND", "Konu bulunamadı");
  if (existing.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi oluşturduğunuz konuları güncelleyebilirsiniz.");
  }

  const data = await readData();
  const student = data.students.find((s) => s.id === existing.studentId);
  const access = assertStudentAccess(ctx, student, existing.studentId);
  if (!access.ok) return fail(access.code, access.message);

  try {
    const { topicId, ...patch } = v.data;
    const updated = await updateCurriculumTopic(ctx.tenantId, topicId, {
      ...patch,
      updatedBy: ctx.userId,
    });
    if (!updated) return fail("NOT_FOUND", "Konu bulunamadı");
    audit(ctx, "curriculum.update", "StudentCurriculumTopic", topicId, {
      status: patch.status,
      progressPercent: patch.progressPercent,
    });
    return ok({ topicId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateCurriculumTopic failed");
  }
}

/**
 * TEACHER/PARENT/STUDENT/admin — öğrenci müfredat listesi + genel ilerleme.
 * PARENT/STUDENT özet (history/notes yok); TEACHER/admin tam kayıt.
 */
export async function listCurriculumForStudentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<
  ServiceResult<{
    topics: StudentCurriculumTopic[] | ReturnType<typeof toCurriculumSummary>[];
    overallPercent: number;
    progressExplanation: string;
  }>
> {
  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;

  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === v.data.studentId);
    const access = assertStudentAccess(ctx, student, v.data.studentId);
    if (!access.ok) return fail(access.code, access.message);

    const topics = await listCurriculumTopicsForStudent(ctx.tenantId, v.data.studentId);
    const overallPercent = computeOverallCurriculumProgress(topics);
    const progressExplanation =
      topics.length === 0
        ? "Henüz konu tanımlanmadı; genel ilerleme 0%."
        : `Genel ilerleme, ${topics.length} konunun progressPercent değerlerinin aritmetik ortalamasıdır (eşit ağırlık).`;

    if (ctx.role === "PARENT" || ctx.role === "STUDENT") {
      return ok({
        topics: topics.map(toCurriculumSummary),
        overallPercent,
        progressExplanation,
      });
    }
    return ok({ topics, overallPercent, progressExplanation });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listCurriculumForStudent failed");
  }
}


/** PRODUCT_BACKLOG — soft archive / restore (hard delete yok) */
export async function archiveStudentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ studentId: string; archived: boolean }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(archiveStudentSchema, input);
  if (!v.ok) return v;
  try {
    const data = await readData();
    const student = data.students.find((s) => s.id === v.data.studentId);
    if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");
    await updateStudentProfile(v.data.studentId, {
      active: !v.data.archived,
      archivedAt: v.data.archived ? new Date().toISOString() : undefined,
    });
    audit(ctx, v.data.archived ? "student.archive" : "student.restore", "Student", v.data.studentId, {});
    return ok({ studentId: v.data.studentId, archived: v.data.archived });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "archiveStudent failed");
  }
}

/**
 * ÖNCELİK 4 (devam) — öğretmen arşivleme/geri alma (hard delete YOK,
 * `active:false` + `archivedAt`). Öğretmenin GELECEKTEKİ (startAt > şimdi)
 * planlı/devam eden dersleri varsa arşivleme REDDEDİLİR — sessizce ders
 * iptal edilmez veya başka öğretmene taşınmaz; admin önce bu dersleri
 * mevcut taşıma/iptal akışlarıyla (updateLessonScheduleTool/cancelLessonTool)
 * elle çözmelidir. Geri alma (`archived:false`) bu kontrole tabi değildir.
 */
export async function archiveTeacherTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ teacherId: string; archived: boolean; futureLessonCount?: number }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(archiveTeacherSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const teacher = data.teachers.find((t) => t.id === v.data.teacherId);
  if (!teacher) return fail("NOT_FOUND", "Öğretmen bulunamadı");

  if (v.data.archived) {
    const nowIso = new Date().toISOString();
    const futureLessonCount = data.lessons.filter(
      (l) =>
        l.teacherId === v.data.teacherId &&
        (l.status === "scheduled" || l.status === "in_progress") &&
        l.startAt > nowIso
    ).length;
    if (futureLessonCount > 0) {
      return fail(
        "CONFLICT",
        `Bu öğretmenin ${futureLessonCount} gelecekteki planlı dersi var. Arşivlemeden önce bu dersleri başka bir öğretmene taşıyın veya iptal edin.`,
        { futureLessonCount }
      );
    }
  }

  try {
    const updated = await archiveTeacher(v.data.teacherId, v.data.archived);
    if (!updated) return fail("NOT_FOUND", "Öğretmen bulunamadı");
    audit(ctx, v.data.archived ? "teacher.archive" : "teacher.restore", "Teacher", v.data.teacherId, {});
    return ok({ teacherId: v.data.teacherId, archived: v.data.archived });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "archiveTeacher failed");
  }
}

/** ÖNCELİK 4 (devam) — oda düzenleme (ad/kapasite/şube) + pasife alma/geri alma. Hard delete yok. */
export async function updateRoomTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ roomId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(updateRoomSchema, input);
  if (!v.ok) return v;

  const data = await readData();
  const room = data.rooms.find((r) => r.id === v.data.roomId);
  if (!room) return fail("NOT_FOUND", "Oda bulunamadı");
  if (v.data.branchId && !data.settings.branches.some((b) => b.id === v.data.branchId)) {
    return fail("VALIDATION_ERROR", "Şube bulunamadı");
  }

  try {
    const { roomId, active, ...patch } = v.data;
    const updated = await updateRoom(roomId, {
      ...patch,
      ...(active !== undefined
        ? { active, archivedAt: active ? undefined : new Date().toISOString() }
        : {}),
    });
    if (!updated) return fail("NOT_FOUND", "Oda bulunamadı");
    audit(ctx, active === false ? "room.archive" : active === true ? "room.restore" : "room.update", "Room", roomId, patch);
    return ok({ roomId });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateRoom failed");
  }
}

/** T.C. kimlik yazma — şifreli saklama */
export async function setNationalIdTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ entityId: string; masked: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(setNationalIdSchema, input);
  if (!v.ok) return v;
  try {
    const { cipher, last2 } = encryptNationalId(v.data.nationalId);
    if (v.data.entity === "student") {
      await updateStudentProfile(v.data.entityId, {
        nationalIdCipher: cipher,
        nationalIdLast2: last2,
      });
    } else {
      return fail("VALIDATION_ERROR", "Öğretmen T.C. güncelleme bu sürümde yakında.");
    }
    audit(ctx, "pii.national_id.set", v.data.entity === "student" ? "Student" : "Teacher", v.data.entityId, {
      last2,
    });
    return ok({ entityId: v.data.entityId, masked: maskNationalId(last2) });
  } catch (e) {
    return fail("VALIDATION_ERROR", e instanceof Error ? e.message : "setNationalId failed");
  }
}

/** Tam T.C. çözümleme — pii:full + audit */
export async function revealNationalIdTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ nationalId: string; masked: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  if (!canViewFullNationalId(ctx.role)) return fail("FORBIDDEN", "Yetkiniz yok");
  const v = parseOrFail(z.object({
    entity: z.enum(["student", "teacher"]),
    entityId: z.string().min(1),
  }), input);
  if (!v.ok) return v;
  const data = await readData();
  const entity =
    v.data.entity === "student"
      ? data.students.find((s) => s.id === v.data.entityId)
      : data.teachers.find((t) => t.id === v.data.entityId);
  if (!entity || !("nationalIdCipher" in entity) || !entity.nationalIdCipher) {
    return fail("NOT_FOUND", "Kimlik kaydı yok");
  }
  try {
    const { decryptNationalId } = await import("../pii");
    const nationalId = decryptNationalId(entity.nationalIdCipher as string);
    audit(ctx, "pii.national_id.reveal", v.data.entity === "student" ? "Student" : "Teacher", v.data.entityId, {});
    return ok({
      nationalId,
      masked: maskNationalId((entity as { nationalIdLast2?: string }).nationalIdLast2),
    });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "reveal failed");
  }
}

export async function createTrialLessonTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ trialId: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(createTrialLessonSchema, input);
  if (!v.ok) return v;
  const sched = assertSchedulableDate(v.data.startAt, []);
  if (!sched.ok) return fail("VALIDATION_ERROR", sched.message);
  if (ctx.role === "TEACHER" && v.data.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi deneme dersinizi planlayabilirsiniz.");
  }
  const start = new Date(v.data.startAt);
  const end = new Date(start.getTime() + v.data.durationMinutes * 60_000);
  try {
    const trial = await createTrialLesson({
      tenantId: ctx.tenantId,
      name: v.data.name,
      phone: v.data.phone,
      instrument: v.data.instrument as Instrument,
      branchId: v.data.branchId,
      teacherId: v.data.teacherId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      durationMinutes: v.data.durationMinutes,
      createdBy: ctx.userId,
      notes: v.data.notes,
    });
    audit(ctx, "trial.create", "TrialLesson", trial.id, {});
    return ok({ trialId: trial.id });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createTrial failed");
  }
}

export async function listTrialLessonsTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ trials: Awaited<ReturnType<typeof listTrialLessons>> }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  try {
    let trials = await listTrialLessons(ctx.tenantId);
    if (ctx.role === "TEACHER" && ctx.teacherId) {
      trials = trials.filter((t) => t.teacherId === ctx.teacherId);
    }
    return ok({ trials });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listTrial failed");
  }
}

export async function updateTrialLessonStatusTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ trialId: string; status: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(updateTrialLessonStatusSchema, input);
  if (!v.ok) return v;
  const existing = await getTrialLesson(ctx.tenantId, v.data.trialId);
  if (!existing) return fail("NOT_FOUND", "Deneme bulunamadı");
  if (ctx.role === "TEACHER" && existing.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yetkiniz yok");
  }
  try {
    const updated = await updateTrialLessonStatus(ctx.tenantId, v.data.trialId, v.data.status);
    if (!updated) return fail("NOT_FOUND", "Deneme bulunamadı");
    audit(ctx, "trial.status", "TrialLesson", v.data.trialId, { status: v.data.status });
    return ok({ trialId: v.data.trialId, status: updated.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "updateTrial failed");
  }
}

export async function listDocumentTemplatesTool(
  ctx: ServiceContext
): Promise<ServiceResult<{ templates: Awaited<ReturnType<typeof listTemplates>> }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  try {
    const templates = await listTemplates(ctx.tenantId);
    return ok({ templates });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listTemplates failed");
  }
}

export async function createDocumentInstanceTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ documentId: string; reference: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(createDocumentInstanceSchema, input);
  if (!v.ok) return v;
  const tpl = await getTemplate(ctx.tenantId, v.data.templateId);
  if (!tpl) return fail("NOT_FOUND", "Şablon bulunamadı");
  const data = await readData();
  const student = v.data.studentId ? data.students.find((s) => s.id === v.data.studentId) : undefined;
  const branch = student
    ? data.settings.branches.find((b) => b.id === student.branchId)
    : v.data.branchId
      ? data.settings.branches.find((b) => b.id === v.data.branchId)
      : undefined;
  const autoFields: Record<string, string> = {
    date: new Date().toLocaleDateString("tr-TR"),
    studentName: student?.name ?? "",
    parentName: student?.parentName ?? "",
    branchName: branch?.name ?? "",
    educationMethod: student?.educationMethod ?? "",
    enrollmentDate: student?.enrollmentStartDate
      ? new Date(student.enrollmentStartDate).toLocaleDateString("tr-TR")
      : "",
    paymentPlan: student?.paymentMethod
      ? `${student.paymentMethod} · ${student.paymentAmount ?? student.monthlyFee} ₺ · gün ${student.paymentDueDay ?? "—"}`
      : "",
    freeText: "",
    scopes: "",
    name: "",
    phone: "",
    ...v.data.fieldValues,
  };
  try {
    const doc = await createDocumentInstance({
      tenantId: ctx.tenantId,
      templateId: tpl.id,
      kind: tpl.kind,
      fieldValues: autoFields,
      studentId: v.data.studentId,
      teacherId: v.data.teacherId,
      trialLessonId: v.data.trialLessonId,
      branchId: v.data.branchId ?? student?.branchId,
      createdBy: ctx.userId,
    });
    audit(ctx, "document.create", "DocumentInstance", doc.id, { reference: doc.reference });
    return ok({ documentId: doc.id, reference: doc.reference });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "createDocument failed");
  }
}

/** Evrak detay ekranı + imzalı dosya servis rotası — SCHOOL_ADMIN/SUPER_ADMIN. */
export async function getDocumentInstanceTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ document: DocumentInstance }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(z.object({ documentId: z.string().min(1) }), input);
  if (!v.ok) return v;
  try {
    const { getDocumentInstance } = await import("../documents");
    const document = await getDocumentInstance(ctx.tenantId, v.data.documentId);
    if (!document) return fail("NOT_FOUND", "Belge bulunamadı");
    return ok({ document });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "getDocument failed");
  }
}

export async function printDocumentInstanceTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ documentId: string; reference: string; printCount: number; html?: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(z.object({ documentId: z.string().min(1) }), input);
  if (!v.ok) return v;
  try {
    const doc = await markDocumentPrinted(ctx.tenantId, v.data.documentId);
    if (!doc) return fail("NOT_FOUND", "Belge bulunamadı");
    audit(ctx, "document.print", "DocumentInstance", doc.id, {
      reference: doc.reference,
      printCount: doc.printCount,
    });
    return ok({
      documentId: doc.id,
      reference: doc.reference,
      printCount: doc.printCount,
      html: doc.renderedHtml,
    });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "printDocument failed");
  }
}

export async function listStudentDocumentsTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ documents: Awaited<ReturnType<typeof listDocumentsForStudent>> }>> {
  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;
  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);
  try {
    const documents = await listDocumentsForStudent(ctx.tenantId, v.data.studentId);
    return ok({ documents });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listDocuments failed");
  }
}

const documentInstanceFiltersSchema = z.object({
  kind: z.string().optional(),
  status: z.string().optional(),
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
  branchId: z.string().optional(),
  reference: z.string().optional(),
});

/** Evraklar Merkezi ana tablosu — kurumun tüm evrakları, isteğe bağlı filtrelerle. */
export async function listDocumentInstancesTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ documents: Awaited<ReturnType<typeof listDocumentInstances>> }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(documentInstanceFiltersSchema, input);
  if (!v.ok) return v;
  try {
    const documents = await listDocumentInstances(ctx.tenantId, v.data as DocumentInstanceFilters);
    return ok({ documents });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "listDocumentInstances failed");
  }
}

/** Silme yok — arşivleme durumu "İptal Edildi"ye geçirir. */
export async function archiveDocumentInstanceTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ documentId: string; status: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(z.object({ documentId: z.string().min(1) }), input);
  if (!v.ok) return v;
  try {
    const doc = await archiveDocumentInstance(ctx.tenantId, v.data.documentId);
    if (!doc) return fail("NOT_FOUND", "Belge bulunamadı");
    audit(ctx, "document.archive", "DocumentInstance", doc.id, {});
    return ok({ documentId: doc.id, status: doc.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "archiveDocument failed");
  }
}

const uploadSignedDocumentSchema = z.object({
  documentId: z.string().min(1),
  fileName: z.string().min(1),
  fileMimeType: z.string().min(1),
  fileData: z.string().max(2_800_000),
});

/** İmzalı/taranmış sürüm yükleme — status "uploaded" olur, dosya tipi/boyutu Zod'da doğrulanır. */
export async function uploadSignedDocumentTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ documentId: string; status: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(uploadSignedDocumentSchema, input);
  if (!v.ok) return v;
  try {
    const doc = await uploadSignedDocumentFile(ctx.tenantId, v.data.documentId, {
      fileName: v.data.fileName,
      fileMimeType: v.data.fileMimeType,
      fileData: v.data.fileData,
    });
    if (!doc) return fail("NOT_FOUND", "Belge bulunamadı");
    audit(ctx, "document.upload_signed", "DocumentInstance", doc.id, { fileName: v.data.fileName });
    return ok({ documentId: doc.id, status: doc.status });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "uploadSignedDocument failed");
  }
}

export async function resolveCollectionsIbanTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ bank: string; bankLabel: string; iban?: string }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN", "AI_AGENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);
  const v = parseOrFail(z.object({ studentId: z.string().min(1) }), input);
  if (!v.ok) return v;
  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Öğrenci yok");
  const settings = data.settings.collectionsSettings ?? { frequencyLimitDays: 3, autoSendEnabled: false };
  const r = resolveCollectionsIban(student.studentType, settings);
  return ok({ bank: r.bank, bankLabel: r.bankLabel, iban: r.iban });
}


/**
 * Geldi / İşlendi / Telafi — TEACHER own lesson, admin all in tenant.
 *
 * ÖNCELİK 4 (devam) — TEK, birbirini dışlayan statü davranışı: ilk tıklama
 * (henüz hiçbir statü etkin değilken) API'ye ANINDA kaydeder. Zaten farklı
 * bir statü etkinse ve `confirmSwitch:true` GÖNDERİLMEMİŞSE hiçbir yazma
 * yapmadan `needsConfirmation:true` + mevcut/istenen statüyü döner — client
 * bunu onay/iptal popup'ı açmak için kullanır; yalnızca kullanıcı onaylayıp
 * `confirmSwitch:true` ile tekrar çağırınca gerçek geçiş (`switchLessonOpsFlagLive`)
 * uygulanır. Aynı statüye tekrar tıklama her zaman no-op/idempotent kalır.
 */
export async function setLessonOpsFlagTool(
  ctx: ServiceContext,
  input: unknown
): Promise<
  ServiceResult<{
    lessonId: string;
    flag: string;
    alreadySet: boolean;
    message: string;
    needsConfirmation?: boolean;
    currentStatus?: string | null;
  }>
> {
  const auth = requireRole(ctx, ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      lessonId: z.string().min(1),
      flag: z.enum(["attended", "processed", "makeup"]),
      /** Kullanıcı, farklı bir statüden geçişi onay popup'ında ONAYLADIYSA true. */
      confirmSwitch: z.boolean().optional(),
    }),
    input
  );
  if (!v.ok) return v;

  const data = await readData();
  const lesson = data.lessons.find((l) => l.id === v.data.lessonId);
  if (!lesson) return fail("NOT_FOUND", "Ders bulunamadı");
  if (ctx.role === "TEACHER" && lesson.teacherId !== ctx.teacherId) {
    return fail("FORBIDDEN", "Yalnızca kendi dersinizde işlem yapabilirsiniz.");
  }

  // ÖNCELİK 4 — Yoklama Takvimi: kapalı günde hiçbir yoklama/mali aksiyon
  // yapılamaz (manuel istisna > resmî tatil > dönem haftalık kuralı sırası).
  const student = data.students.find((s) => s.id === lesson.studentId);
  const term = student?.termType ?? "guz";
  const overrides = await listClosedDays(ctx.tenantId);
  const dayStatus = resolveDayStatus(new Date(lesson.startAt), term, overrides);
  if (dayStatus.status === "closed") {
    return fail(
      "VALIDATION_ERROR",
      `Bu gün kapalı (${dayStatus.label}) — yoklama/tahsilat işlemi yapılamaz.`
    );
  }

  const current = effectiveLessonOpsStatus(lesson);
  if (current !== null && current !== v.data.flag && !v.data.confirmSwitch) {
    return ok({
      lessonId: v.data.lessonId,
      flag: v.data.flag,
      alreadySet: false,
      needsConfirmation: true,
      currentStatus: current,
      message: `Bu ders zaten "${current}" olarak işaretli. "${v.data.flag}" olarak değiştirmek için onaylayın.`,
    });
  }

  try {
    const result = await switchLessonOpsFlagLive(v.data.lessonId, v.data.flag, ctx.userId);
    if (!result.ok) return fail("VALIDATION_ERROR", result.message);
    if (!result.alreadySet) {
      audit(ctx, `lesson.ops.${v.data.flag}`, "Lesson", v.data.lessonId, {
        flag: v.data.flag,
        switchedFrom: current !== v.data.flag ? current : undefined,
      });
    }
    return ok({
      lessonId: v.data.lessonId,
      flag: v.data.flag,
      alreadySet: result.alreadySet,
      message: result.message,
    });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "setLessonOpsFlag failed");
  }
}

/**
 * ÖNCELİK 4 — Yoklama Takvimi: bir tarih için gün durumu (statü) + o günün
 * dersleri. Admin tüm öğrencileri, öğretmen yalnızca kendi öğrencilerini,
 * PARENT/STUDENT yalnızca (session'a bağlı) KENDİ öğrencisini görebilir —
 * salt okunur, `assertStudentAccess` ile ownership kesin kontrol edilir
 * (rol listesine girmesi TEK BAŞINA erişim vermez, bkz. aşağı).
 */
export type AttendanceCalendarLessonPaymentInfo = {
  lessonId: string;
  amount: number;
  /** ÖNCELİK 4 (devam) — "Tutar kayıt tarihi": bu Payment satırının SİSTEME kaydedildiği an. */
  recordedAt: string;
  /** Nakit/Havale/Kredi Kartı — Payment.method varsa o, yoksa öğrencinin varsayılan ödeme yöntemi (tahmini olarak işaretlenir). */
  method?: string;
  methodIsStudentDefault: boolean;
  status: string;
  source: string;
};

export async function getAttendanceCalendarMonthTool(
  ctx: ServiceContext,
  input: unknown
): Promise<
  ServiceResult<{
    year: number;
    month: number;
    term: string;
    days: Array<{
      date: string;
      status: string;
      reason: string;
      label: string;
      lessonIds: string[];
      payments: AttendanceCalendarLessonPaymentInfo[];
    }>;
  }>
> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN", "AI_AGENT", "PARENT", "STUDENT"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      studentId: z.string().min(1),
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
    }),
    input
  );
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  const access = assertStudentAccess(ctx, student, v.data.studentId);
  if (!access.ok) return fail(access.code, access.message);
  if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");

  const term = student.termType ?? "guz";
  const overrides = await listClosedDays(ctx.tenantId);
  const { resolveMonthStatuses } = await import("../attendance-calendar");
  const statuses = resolveMonthStatuses(v.data.year, v.data.month, term, overrides);

  const days = statuses.map((s) => {
    const dayLessons = data.lessons.filter((l) => l.studentId === student.id && l.startAt.slice(0, 10) === s.date);
    const lessonIds = dayLessons.map((l) => l.id);
    // ÖNCELİK 4 (devam) — TEK kaynak: mevcut Payment modeli (source:"lesson_ops"),
    // ikinci/çelişkili bir kayıt yaratılmaz — yalnızca OKUNUR ve gösterilir.
    const payments: AttendanceCalendarLessonPaymentInfo[] = dayLessons
      .map((l) => data.payments.find((p) => p.lessonId === l.id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        lessonId: p.lessonId!,
        amount: p.amount,
        recordedAt: p.createdAt ?? p.dueDate,
        method: p.method ?? student.paymentMethod,
        methodIsStudentDefault: !p.method && !!student.paymentMethod,
        status: p.status,
        source: p.source ?? "manual",
      }));
    return { ...s, lessonIds, payments };
  });

  return ok({ year: v.data.year, month: v.data.month, term, days });
}

/** ÖNCELİK 4 — admin özel kapalı/zorla-açık gün istisnası (audit'li). */
export async function setDayOverrideTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ date: string; isOpen: boolean }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      name: z.string().default(""),
      isOpen: z.boolean(),
      kind: z.enum(["public_holiday", "custom"]).default("custom"),
    }),
    input
  );
  if (!v.ok) return v;

  try {
    const row = await setClosedDay({
      tenantId: ctx.tenantId,
      date: v.data.date,
      name: v.data.name || (v.data.isOpen ? "Zorla açık" : "Kapalı (yönetici)"),
      kind: v.data.kind,
      isOpen: v.data.isOpen,
      createdBy: ctx.userId,
    });
    audit(ctx, "attendance_calendar.day_override.set", "ClosedDay", row.id, {
      date: v.data.date,
      isOpen: v.data.isOpen,
    });
    return ok({ date: row.date, isOpen: row.isOpen });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "setDayOverride failed");
  }
}

/**
 * ÖNCELİK 4 — öğrenci+ay başına aylık planlanan tutar (Tutar). Yalnızca
 * planlanan borcu günceller — asla "paid"/collected kaydı yaratmaz.
 * source:"monthly_plan" ile lesson_ops'tan kesin ayrışır (mükerrer sayım yok).
 */
export async function setMonthlyPlanAmountTool(
  ctx: ServiceContext,
  input: unknown
): Promise<ServiceResult<{ paymentId: string; studentId: string; month: string; amount: number }>> {
  const auth = requireRole(ctx, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return fail("FORBIDDEN", auth.message);

  const v = parseOrFail(
    z.object({
      studentId: z.string().min(1),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      amount: z.number().min(0),
    }),
    input
  );
  if (!v.ok) return v;

  const data = await readData();
  const student = data.students.find((s) => s.id === v.data.studentId);
  if (!student) return fail("NOT_FOUND", "Öğrenci bulunamadı");

  try {
    const { paymentId } = await upsertMonthlyPlanPayment({
      studentId: v.data.studentId,
      month: v.data.month,
      amount: v.data.amount,
    });
    audit(ctx, "attendance_calendar.monthly_plan.set", "Payment", paymentId, {
      studentId: v.data.studentId,
      month: v.data.month,
      amount: v.data.amount,
    });
    return ok({ paymentId, studentId: v.data.studentId, month: v.data.month, amount: v.data.amount });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "setMonthlyPlanAmount failed");
  }
}

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
