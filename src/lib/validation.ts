import { z } from "zod";
import { LESSON_DURATION_OPTIONS } from "./lesson-duration";

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
  durationMinutes: z.coerce.number().refine((v) => (LESSON_DURATION_OPTIONS as readonly number[]).includes(v), {
    message: "Ders süresi yalnızca 30, 40 veya 50 dakika olabilir.",
  }).optional(),
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
  weekday: z.coerce
    .number()
    .int()
    .min(0)
    .max(6)
    .refine((d) => d !== 1, { message: "Pazartesi okul kapalıdır — bu gün için ders serisi oluşturulamaz." }),
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

const scoreItem = () => z.number().int().min(1).max(5);

/** EPIC 7 — A–E bölümlerinin her maddesi 1–5 puan; not alanları zorunlu (boş bırakılamaz). */
export const createAssessmentSchema = z.object({
  lessonId: z.string().min(1),
  studentId: z.string().min(1),
  teknikBecerisi: scoreItem(),
  notaOkuma: scoreItem(),
  muzikalite: scoreItem(),
  ritimDuyusu: scoreItem(),
  calismaDuzeni: scoreItem(),
  evOdeviTamamlama: scoreItem(),
  dersKatilimi: scoreItem(),
  motivasyon: scoreItem(),
  genelIlerleme: scoreItem(),
  hedefeUlasma: scoreItem(),
  strengthNote: z.string().min(1),
  nextStepsNote: z.string().min(1),
  improvementNote: z.string().min(1),
  parentPrivateNote: z.string().optional(),
  parentNoteVisibleToStudent: z.boolean().optional(),
  teacherSignedName: z.string().min(1),
});

export const startLessonSchema = z.object({
  lessonId: z.string().min(1),
});

export const endLessonSchema = z.object({
  lessonId: z.string().min(1),
});

/** EPIC 8 — düzeltme yalnızca admin + zorunlu notla; en az bir zaman alanı gerekir. */
export const correctLessonTimesSchema = z
  .object({
    lessonId: z.string().min(1),
    actualStartAt: z.string().min(1).optional(),
    actualEndAt: z.string().min(1).optional(),
    note: z.string().min(1, "Düzeltme notu zorunludur"),
  })
  .refine((d) => d.actualStartAt !== undefined || d.actualEndAt !== undefined, {
    message: "actualStartAt veya actualEndAt gerekli",
  });

const availabilityWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat HH:mm biçiminde olmalı"),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat HH:mm biçiminde olmalı"),
  })
  .refine((w) => w.start < w.end, { message: "Bitiş saati başlangıçtan sonra olmalı" });

/** EPIC 9 — TEACHER kendi müsaitliği için öneri oluşturur, doğrudan yazmaz. */
export const proposeTeacherAvailabilitySchema = z.object({
  proposedAvailability: z.array(availabilityWindowSchema),
  exceptions: z.unknown().optional(),
});

/** EPIC 9 — yalnızca SCHOOL_ADMIN/SUPER_ADMIN; not opsiyonel. */
export const reviewTeacherAvailabilityRequestSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().optional(),
});

const STUDENT_TYPE_FOR_HOMEWORK = [
  "Hobi",
  "MEB",
  "London College of Music Hazırlık",
  "Konservatuvar Hazırlık",
  "Güzel Sanatlar Lisesi Hazırlık",
] as const;
const INSTRUMENT_FOR_HOMEWORK = ["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"] as const;

/**
 * EPIC 6B — küçük dosya/foto/kısa video için base64; ~2MB ham veri sınırı
 * (base64 şişmesiyle ~2.7M karakter) — yeni bir obje depolama bağımlılığı
 * eklemeden DB/JSON'da taşınabilir kalması için (bkz. IMPLEMENTATION_PLAN.md
 * EPIC 6 "Dosya/video erişimi" bölümü, "(A) seçeneği").
 */
const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(200).optional(),
  fileMimeType: z.string().min(1).max(100).optional(),
  fileData: z.string().max(2_800_000).optional(),
});

/** EPIC 6B — TEACHER kendi öğrencisi için ödev oluşturur. */
export const createHomeworkSchema = z.object({
  studentId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  dueDate: z.string().min(1),
});

/** EPIC 6B — STUDENT kendi ödevine teslim yükler. */
export const submitHomeworkSchema = z
  .object({
    homeworkId: z.string().min(1),
    note: z.string().max(2000).optional(),
  })
  .extend(fileUploadSchema.shape);

/** EPIC 6D — TEACHER bir teslime geri bildirim yazar. */
export const reviewHomeworkSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  teacherFeedback: z.string().min(1),
});

/** EPIC 6B — TEACHER materyal/pratik videosu paylaşır. */
export const createTeachingMaterialSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    targetStudentType: z.enum(STUDENT_TYPE_FOR_HOMEWORK).optional(),
    targetInstrument: z.enum(INSTRUMENT_FOR_HOMEWORK).optional(),
    targetLevel: z.string().min(1).max(100).optional(),
  })
  .extend(fileUploadSchema.shape);

/**
 * EPIC 6C — veli/öğrenci öğretmen hakkında yapılandırılmış geri bildirim
 * gönderir. Beş kriter ZORUNLU ve sabit (bkz. TEACHER_FEEDBACK_CRITERIA) —
 * rastgele anahtarlı bir Record değil, tam olarak bu beş alan.
 */
const teacherFeedbackScoreSchema = z.number().int().min(1).max(5);

export const submitTeacherFeedbackSchema = z.object({
  studentId: z.string().min(1),
  scores: z.object({
    clarity: teacherFeedbackScoreSchema,
    communication: teacherFeedbackScoreSchema,
    effectiveness: teacherFeedbackScoreSchema,
    motivation: teacherFeedbackScoreSchema,
    punctuality: teacherFeedbackScoreSchema,
  }),
  continueWithTeacher: z.enum(["yes", "unsure", "no"]).optional(),
  /** Güvenli düz metin; HTML asla render edilmez (bkz. UI katmanı). */
  comment: z.string().max(1000).optional(),
});

/** Müfredat konu durumu */
export const curriculumTopicStatusSchema = z.enum([
  "planned",
  "in_progress",
  "mastered",
  "deferred",
]);

/** TEACHER — öğrenciye müfredat konusu ekler */
export const createCurriculumTopicSchema = z.object({
  studentId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: curriculumTopicStatusSchema.optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().max(2000).optional(),
});

/** TEACHER — konu günceller (durum/ilerleme/not) */
export const updateCurriculumTopicSchema = z.object({
  topicId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: curriculumTopicStatusSchema.optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().max(2000).nullable().optional(),
  changeNote: z.string().max(500).optional(),
});


export const EDUCATION_METHOD_ENUM = ["Suzuki","Klasik","LCM","MEB","Kurum İçi","Diğer"] as const;
export const LESSON_DURATION_PREF_ENUM = [30, 40, 50] as const;

export const createTrialLessonSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(30),
  instrument: z.string().min(1),
  branchId: z.string().min(1),
  teacherId: z.string().min(1),
  startAt: z.string().min(1),
  durationMinutes: z.union([z.literal(30), z.literal(40), z.literal(50)]),
  notes: z.string().max(2000).optional(),
});

export const updateTrialLessonStatusSchema = z.object({
  trialId: z.string().min(1),
  status: z.enum([
    "planned","attended","considering","awaiting_enrollment",
    "will_continue","will_not_continue","cancelled",
  ]),
  convertToStudent: z.boolean().optional(),
});

export const archiveStudentSchema = z.object({
  studentId: z.string().min(1),
  archived: z.boolean(),
});

export const setNationalIdSchema = z.object({
  entity: z.enum(["student","teacher"]),
  entityId: z.string().min(1),
  nationalId: z.string().min(11).max(20),
});

export const createDocumentInstanceSchema = z.object({
  templateId: z.string().min(1),
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
  trialLessonId: z.string().optional(),
  branchId: z.string().optional(),
  fieldValues: z.record(z.string(), z.string()).default({}),
});

export const socialMediaConsentSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["granted","denied","withdrawn","expired"]),
  representativeName: z.string().min(1),
  relationship: z.string().min(1),
  scopes: z.array(z.enum(["photo","video","name","voice","website","instagram","other"])).min(1),
  sourceDocumentRef: z.string().optional(),
});

export const closedDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(120),
});
