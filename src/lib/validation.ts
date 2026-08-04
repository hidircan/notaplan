import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
});

export const updateBranchSchema = branchSchema.partial().extend({
  branchId: z.string().min(1),
});

export const attendanceSchema = z.object({
  lessonId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "cancelled_by_school"]),
  reason: z.string().optional(),
});

const optionalEmail = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v : undefined))
  .pipe(z.string().email().optional());

const STUDENT_TYPE_ENUM = [
  "Hobi",
  "MEB",
  "London College of Music Hazırlık",
  "Konservatuvar Hazırlık",
  "Güzel Sanatlar Lisesi Hazırlık",
] as const;

/** EPIC 4 — öğrenci profil alanları hepsi opsiyonel; boş bırakılırsa "" olarak değil undefined olarak normalize edilir. */
const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const studentSchema = z.object({
  name: z.string().min(1),
  email: optionalEmail,
  phone: z.string().min(1),
  parentName: z.string().min(1),
  parentPhone: z.string().min(1),
  branchId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  teacherId: z.string().min(1),
  packageName: z.string().min(1),
  weeklyLessonCount: z.coerce.number().int().min(1),
  monthlyFee: z.coerce.number().int().min(0),
  notes: z.string().optional(),
  studentType: z.enum(STUDENT_TYPE_ENUM).optional(),
  enrollmentStartDate: optionalTrimmed,
  enrollmentEndDate: optionalTrimmed,
  level: optionalTrimmed,
  targetExam: optionalTrimmed,
  specialNotes: optionalTrimmed,
});

export const updateStudentProfileSchema = z.object({
  studentId: z.string().min(1),
  studentType: z.enum(STUDENT_TYPE_ENUM).optional(),
  enrollmentStartDate: optionalTrimmed,
  enrollmentEndDate: optionalTrimmed,
  level: optionalTrimmed,
  targetExam: optionalTrimmed,
  specialNotes: optionalTrimmed,
});

export const teacherSchema = z.object({
  name: z.string().min(1),
  email: optionalEmail,
  phone: z.string().min(1),
  branchId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
});

export const roomSchema = z.object({
  name: z.string().min(1),
  branchId: z.string().min(1),
  capacity: z.coerce.number().int().min(1),
  instruments: z
    .array(z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]))
    .min(1),
});

export const lessonSchema = z.object({
  studentId: z.string().min(1),
  teacherId: z.string().min(1),
  roomId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  startAt: z.string().min(1),
});

export const paymentRecordSchema = z.object({
  studentId: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().int().min(1),
  dueDate: z.string().min(1),
});

export const updateLessonScheduleSchema = z
  .object({
    lessonId: z.string().min(1),
    startAt: z.string().min(1).optional(),
    durationMinutes: z.coerce.number().int().min(30).max(240).optional(),
  })
  .refine((d) => d.startAt !== undefined || d.durationMinutes !== undefined, {
    message: "startAt veya durationMinutes gerekli",
  });

export const cancelLessonSchema = z.object({
  lessonId: z.string().min(1),
});

export const suggestLessonSlotsSchema = z.object({
  studentId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  teacherId: z.string().min(1).optional(),
  daysAhead: z.coerce.number().int().positive().max(60).optional(),
  maxSlots: z.coerce.number().int().positive().max(50).optional(),
});

export const lessonSeriesParamsSchema = z.object({
  studentId: z.string().min(1),
  teacherId: z.string().min(1),
  roomId: z.string().min(1),
  branchId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat HH:mm biçiminde olmalı"),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  startsOn: z.string().min(1),
  endsOn: z.string().min(1),
});

export const createLessonSeriesSchema = lessonSeriesParamsSchema.extend({
  skipConflicts: z.coerce.boolean().optional(),
});

export const cancelSeriesFromLessonSchema = z.object({
  lessonId: z.string().min(1),
});

export const cancelEntireSeriesSchema = z.object({
  seriesId: z.string().min(1),
});

export const makeupSlotSchema = z.object({
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  teacherId: z.string().min(1),
  roomId: z.string().min(1),
  branchId: z.string().min(1),
  score: z.number(),
  reasons: z.array(z.string()),
});

const INSTRUMENT_ENUM = ["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"] as const;

export const createFeeRuleSchema = z.object({
  teacherId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  instrument: z.enum(INSTRUMENT_ENUM).optional(),
  perMinuteRate: z.coerce.number().positive(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().min(1).optional(),
});

export const updateFeeRuleSchema = z.object({
  ruleId: z.string().min(1),
  teacherId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  instrument: z.enum(INSTRUMENT_ENUM).optional(),
  perMinuteRate: z.coerce.number().positive().optional(),
  effectiveFrom: z.string().min(1).optional(),
  effectiveTo: z.string().min(1).optional(),
});

export const computeTeacherPayoutSchema = z.object({
  teacherId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export const createTeacherPayoutSchema = computeTeacherPayoutSchema;

export const markTeacherPayoutPaidSchema = z.object({
  payoutId: z.string().min(1),
  method: z.string().min(1).optional(),
});

export const updateFeeRoundingModeSchema = z.object({
  feeRoundingMode: z.enum(["exact_minutes", "round_30", "fixed_package"]),
});

/** EPIC 1 — veli kendi çocuğu için, admin herkes için değiştirebilir (bkz. updateCommunicationPreferenceTool). */
export const updateCommunicationPreferenceSchema = z.object({
  studentId: z.string().min(1),
  communicationOptOut: z.boolean(),
});

/** EPIC 1 — okulun gecikmiş tahsilat otomasyon ayarları. */
export const updateCollectionsSettingsSchema = z.object({
  frequencyLimitDays: z.number().int().min(1).max(30),
  autoSendEnabled: z.boolean(),
});

export const markNotificationReadSchema = z.object({
  notificationId: z.string().min(1),
});

const STUDENT_TYPE_FOR_AUDIENCE = [
  "Hobi",
  "MEB",
  "London College of Music Hazırlık",
  "Konservatuvar Hazırlık",
  "Güzel Sanatlar Lisesi Hazırlık",
] as const;

/**
 * EPIC 5 — audienceRef, audienceType'a göre farklı şekiller alır; hangi
 * anahtarların dolu olması gerektiği createAnnouncementTool içinde değil
 * burada, şema seviyesinde zorlanır (branch→branchId, studentType→
 * studentType, selected→userIds; diğerleri ref gerektirmez).
 */
export const createAnnouncementSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    attachmentUrl: z.string().url().optional(),
    audienceType: z.enum(["all", "branch", "teachers", "parents", "students", "studentType", "selected"]),
    audienceRef: z
      .union([
        z.object({ branchId: z.string().min(1) }),
        z.object({ studentType: z.enum(STUDENT_TYPE_FOR_AUDIENCE) }),
        z.object({ userIds: z.array(z.string().min(1)).min(1) }),
      ])
      .optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    pinned: z.boolean().optional(),
    publishAt: z.string().min(1).optional(),
    expireAt: z.string().min(1).optional(),
  })
  .refine(
    (d) => {
      if (d.audienceType === "branch") return !!d.audienceRef && "branchId" in d.audienceRef;
      if (d.audienceType === "studentType") return !!d.audienceRef && "studentType" in d.audienceRef;
      if (d.audienceType === "selected") return !!d.audienceRef && "userIds" in d.audienceRef;
      return true;
    },
    { message: "audienceType için gerekli audienceRef alanı eksik" }
  );

export const updateAnnouncementStatusSchema = z.object({
  announcementId: z.string().min(1),
  status: z.enum(["draft", "published", "archived"]),
});

export const markAnnouncementReadSchema = z.object({
  announcementId: z.string().min(1),
});
