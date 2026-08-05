/** Şimdilik aktif enstrümanlar; ileride genişletilecek */
export type Instrument =
  | "Piyano"
  | "Yan Flüt"
  | "Gitar"
  | "Bateri"
  | "Keman"
  | "Şan";

export const INSTRUMENTS: Instrument[] = [
  "Piyano",
  "Yan Flüt",
  "Gitar",
  "Bateri",
  "Keman",
  "Şan",
];

/**
 * Artık kapalı bir küme değil — okul admini `/panel/subeler`den istediği
 * kadar şube ekleyebilir. Demo şubeleri ("erzene", "evka3") sabit id'lerle
 * seed'de yaşamaya devam eder, ama tip düzeyinde özel bir anlamları yoktur.
 */
export type BranchId = string;

export interface Branch {
  id: BranchId;
  name: string;
  shortName: string;
  address: string;
  phone: string;
  city: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "cancelled_by_school";
/**
 * EPIC 10 (IMPLEMENTATION_PLAN.md) — "awaiting_info" eklendi: AI, WhatsApp
 * mesajından telafi sebebini düşük güvenle çıkarırsa (veya hiç çıkaramazsa)
 * talep bu durumda oluşturulur — asla doğrudan "pending"e düşmez. Yönetici
 * netleştirene kadar açık sayılır (bkz. src/lib/utils.ts statusLabel/statusColor,
 * src/app/panel/telafi/page.tsx açık/kapalı ayrımı).
 */
export type MakeupStatus =
  | "pending"
  | "suggested"
  | "awaiting_info"
  | "confirmed"
  | "completed"
  | "expired"
  | "cancelled";
export type PaymentStatus = "paid" | "pending" | "overdue" | "partial";
export type LessonType = "regular" | "makeup" | "trial" | "group";

/** Haftalık müsaitlik penceresi: 0=Pazar ... 6=Cumartesi */
export type AvailabilityWindow = { dayOfWeek: number; start: string; end: string };

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  branchId: BranchId;
  instruments: Instrument[];
  availability: AvailabilityWindow[];
  maxDailyLessons: number;
  active: boolean;
  color: string;
}

/**
 * EPIC 9 (IMPLEMENTATION_PLAN.md) — öğretmenin müsaitlik değişikliği önerisi.
 * `Teacher.availability` DOĞRUDAN değişmez; bu kayıt onaylanınca uygulanır.
 */
export type TeacherAvailabilityRequestStatus = "pending" | "approved" | "rejected";

export interface TeacherAvailabilityRequest {
  id: string;
  teacherId: string;
  proposedAvailability: AvailabilityWindow[];
  exceptions?: unknown;
  status: TeacherAvailabilityRequestStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * EPIC 4 (IMPLEMENTATION_PLAN.md) — öğrencinin eğitim programı türü. Sabit
 * bir kapalı küme (kurum admini yeni tür ekleyemez — ileride gerekirse
 * `Branch` gibi kurum-tanımlı bir modele taşınır).
 */
export type StudentType =
  | "Hobi"
  | "MEB"
  | "London College of Music Hazırlık"
  | "Konservatuvar Hazırlık"
  | "Güzel Sanatlar Lisesi Hazırlık";

export const STUDENT_TYPES: StudentType[] = [
  "Hobi",
  "MEB",
  "London College of Music Hazırlık",
  "Konservatuvar Hazırlık",
  "Güzel Sanatlar Lisesi Hazırlık",
];

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  branchId: BranchId;
  instruments: Instrument[];
  teacherId: string;
  packageName: string;
  weeklyLessonCount: number;
  monthlyFee: number;
  active: boolean;
  notes: string;
  createdAt: string;
  /** EPIC 4 — hepsi opsiyonel; boşsa UI "Belirtilmemiş" gösterir, hata vermez. */
  studentType?: StudentType;
  /** ISO tarih */
  enrollmentStartDate?: string;
  /** ISO tarih — verilmezse açık uçlu (hâlâ kayıtlı) */
  enrollmentEndDate?: string;
  level?: string;
  /** Hedef sınav / performans dönemi — serbest metin */
  targetExam?: string;
  specialNotes?: string;
  /** EPIC 1 — true ise veli otomatik tahsilat hatırlatmalarından çıkmıştır. */
  communicationOptOut?: boolean;
}

/** EPIC 4 — öğrenci eğitim profili alanları, tek bir yerden güncellenir. */
export type StudentProfilePatch = Partial<
  Pick<
    Student,
    | "studentType"
    | "enrollmentStartDate"
    | "enrollmentEndDate"
    | "level"
    | "targetExam"
    | "specialNotes"
    | "communicationOptOut"
  >
>;

/**
 * EPIC 1 (IMPLEMENTATION_PLAN.md) — okulun gecikmiş tahsilat otomasyon
 * ayarları. `frequencyLimitDays`: aynı ödeme için iki hatırlatma arasında
 * geçmesi gereken en az gün sayısı. `autoSendEnabled`: true olsa bile
 * wa.me üzerinden GERÇEK gönderim her zaman bir insanın linke tıklamasını
 * gerektirir — bu ayar yalnızca taslağın "approved" durumuna otomatik
 * geçip geçmeyeceğini belirler (varsayılan: false, admin onayı zorunlu).
 */
export interface CollectionsSettings {
  frequencyLimitDays: number;
  autoSendEnabled: boolean;
}

export const DEFAULT_COLLECTIONS_SETTINGS: CollectionsSettings = {
  frequencyLimitDays: 3,
  autoSendEnabled: false,
};

/** EPIC 1 — uygulama içi bildirim (veli portalı, admin panel bildirim çanı). */
export interface Notification {
  id: string;
  targetUserId?: string;
  targetStudentId?: string;
  kind: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
}

/**
 * EPIC 5 (IMPLEMENTATION_PLAN.md) — duyuru merkezi. Hedef kitle eşleşmesi
 * SUNUCU tarafında yapılır (bkz. src/lib/announcements/audience.ts) — asla
 * client'a hedef-dışı duyuru verisi gönderilmez. `students` şu an `parents`
 * ile aynı alıcı kümesine eşlenir çünkü ayrı bir STUDENT rolü henüz yok
 * (EPIC 6A); rol eklendiğinde bu eşleme güncellenecek.
 */
export type AnnouncementAudienceType =
  | "all"
  | "branch"
  | "teachers"
  | "parents"
  | "students"
  | "studentType"
  | "selected";

export type AnnouncementAudienceRef =
  | { branchId: string }
  | { studentType: StudentType }
  | { userIds: string[] }
  | Record<string, never>;

export type AnnouncementStatus = "draft" | "published" | "archived";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  attachmentUrl?: string;
  audienceType: AnnouncementAudienceType;
  audienceRef?: AnnouncementAudienceRef;
  status: AnnouncementStatus;
  pinned: boolean;
  /** ISO tarih — verilmezse hemen yayında sayılır (status published ise) */
  publishAt?: string;
  /** ISO tarih — verilmezse süresiz */
  expireAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * EPIC 7 (IMPLEMENTATION_PLAN.md) — öğretmen gelişim değerlendirme formu.
 * Her madde 1–5 puan; bkz. src/lib/assessment/score.ts için bölüm/genel
 * ortalama hesaplaması.
 */
export interface AssessmentScores {
  teknikBecerisi: number;
  notaOkuma: number;
  muzikalite: number;
  ritimDuyusu: number;
  calismaDuzeni: number;
  evOdeviTamamlama: number;
  dersKatilimi: number;
  motivasyon: number;
  genelIlerleme: number;
  hedefeUlasma: number;
}

export interface LessonAssessment extends AssessmentScores {
  id: string;
  lessonId: string;
  studentId: string;
  teacherId: string;
  strengthNote: string;
  nextStepsNote: string;
  improvementNote: string;
  /** Yalnızca veli/yönetici görür — bkz. parentNoteVisibleToStudent. */
  parentPrivateNote?: string;
  /** Varsayılan false: parentPrivateNote öğrenciye (EPIC 6A sonrası) gösterilmez. */
  parentNoteVisibleToStudent: boolean;
  teacherSignedName: string;
  /** ISO tarih — sunucu saatiyle damgalanır, client'tan gelen tarihe güvenilmez. */
  teacherSignedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  name: string;
  branchId: BranchId;
  capacity: number;
  instruments: Instrument[];
}

export interface Lesson {
  id: string;
  studentId: string;
  teacherId: string;
  roomId: string;
  branchId: BranchId;
  instrument: Instrument;
  startAt: string;
  endAt: string;
  type: LessonType;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";
  makeupRequestId?: string;
  /** Bu ders bir tekrarlayan seriden üretildiyse ait olduğu LessonSeries.id */
  seriesId?: string;
  /**
   * EPIC 8 (IMPLEMENTATION_PLAN.md) — "Dersi başlat"/"Dersi bitir" ile
   * damgalanan GERÇEK zaman damgaları (planlanan startAt/endAt'tan
   * bağımsız). Düzeltme yalnızca admin + zorunlu notla yapılabilir.
   */
  actualStartAt?: string;
  actualEndAt?: string;
  startCorrectedBy?: string;
  startCorrectionNote?: string;
  endCorrectedBy?: string;
  endCorrectionNote?: string;
  notes?: string;
}

export type LessonSeriesStatus = "active" | "ended" | "cancelled";

/**
 * Haftalık tekrarlayan ders serisi — "Ece her Salı 17:00'de piyano dersi
 * alacak" gibi dönemlik bir kaydın kaynağı. Dönem boyunca üretilen her
 * Lesson, `seriesId` ile bu kayda bağlanır. Seri asla fiziksel silinmez;
 * yalnızca `status` ile pasifleştirilir (ended/cancelled).
 */
export interface LessonSeries {
  id: string;
  studentId: string;
  teacherId: string;
  roomId: string;
  branchId: BranchId;
  instrument: Instrument;
  /** 0=Pazar ... 6=Cumartesi — Teacher.availability ile aynı kural */
  weekday: number;
  /** "HH:mm" */
  startTime: string;
  durationMinutes: number;
  /** ISO tarih — dönemin ilk günü */
  startsOn: string;
  /** ISO tarih — dönemin son günü (dahil) */
  endsOn: string;
  status: LessonSeriesStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
  reason?: string;
  markedAt: string;
  createsMakeupCredit: boolean;
}

export interface MakeupRequest {
  id: string;
  studentId: string;
  teacherId: string;
  branchId: BranchId;
  instrument: Instrument;
  sourceLessonId: string;
  attendanceId: string;
  status: MakeupStatus;
  reason: string;
  expiresAt: string;
  suggestedSlots: MakeupSlot[];
  confirmedLessonId?: string;
  createdAt: string;
  policyNote: string;
  /** EPIC 10 — onay/iptal/ret kararında zorunlu (uygulama katmanında), şemada opsiyonel. */
  decisionNote?: string;
  /** Kararı veren kullanıcının id'si */
  decidedBy?: string;
  /** ISO tarih */
  decidedAt?: string;
  /** ISO tarih — yalnızca onaylandığında set edilir (30 gün, onay anından itibaren) */
  slaDeadline?: string;
  /** 0=yok 1=15gün 2=7gün 3=3gün 4=1gün 5=aşıldı */
  slaEscalationLevel?: number;
}

export interface MakeupSlot {
  startAt: string;
  endAt: string;
  teacherId: string;
  roomId: string;
  branchId: BranchId;
  score: number;
  reasons: string[];
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  paidAmount: number;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
  description: string;
  method?: string;
}

/**
 * EPIC 3 (IMPLEMENTATION_PLAN.md) — kesirli ders süresinin ödenecek dakikaya
 * nasıl çevrileceği:
 * - "exact_minutes" (varsayılan): gerçek dakika üzerinden.
 * - "round_30": her dersin süresi, öğretmen lehine 30 dakikalık dilime
 *   YUKARI yuvarlanır (ör. 35dk → 60dk, 65dk → 90dk).
 * - "fixed_package": gerçek süre yok sayılır, okulun standart ders süresi
 *   (`lessonDurationMinutes`) esas alınır.
 */
export type FeeRoundingMode = "exact_minutes" | "round_30" | "fixed_package";

export interface SchoolSettings {
  /** Multi-tenant id — set at seed / DB; never from client */
  tenantId: string;
  name: string;
  shortName: string;
  city: string;
  website: string;
  email: string;
  phone: string;
  logoUrl: string;
  makeupWindowDays: number;
  lessonDurationMinutes: number;
  workingHours: { start: string; end: string };
  workingDays: number[];
  currency: string;
  branches: Branch[];
  feeRoundingMode: FeeRoundingMode;
  /** EPIC 1 — boşsa DEFAULT_COLLECTIONS_SETTINGS uygulanır. */
  collectionsSettings?: CollectionsSettings;
}

/**
 * Öğretmenin dakika başı ücreti. `branchId`/`instrument` verilmezse o alan
 * için "tüm şubeler"/"tüm enstrümanlar" anlamına gelir — bkz.
 * `resolveFeeRule` (src/lib/teacher-payout.ts) için spesifiklik önceliği.
 * Aynı kapsamda (teacherId+branchId+instrument) tarihi çakışan iki kural
 * aynı anda var olamaz.
 */
export interface TeacherFeeRule {
  id: string;
  teacherId: string;
  branchId?: BranchId;
  instrument?: Instrument;
  perMinuteRate: number;
  /** ISO tarih — bu tarihten itibaren (dahil) geçerli */
  effectiveFrom: string;
  /** ISO tarih — verilmezse açık uçlu; verilirse bu tarih dahil geçerli */
  effectiveTo?: string;
  createdAt: string;
}

/**
 * Bir dönem için öğretmene ödenecek/ödenen tutarın donmuş kaydı.
 * `totalMinutes`/`totalAmount` oluşturma anında hesaplanır ve `TeacherFeeRule`
 * sonradan değişse bile bir daha yeniden hesaplanmaz. `Payment` (öğrenci →
 * okul tahsilatı) ile hiçbir ilişkisi yoktur — bilinçli olarak ayrı bir
 * varlıktır.
 */
export interface TeacherPayout {
  id: string;
  teacherId: string;
  /** ISO tarih — dönemin ilk günü */
  periodStart: string;
  /** ISO tarih — dönemin son günü (dahil) */
  periodEnd: string;
  totalMinutes: number;
  totalAmount: number;
  status: "pending" | "paid";
  paidAt?: string;
  method?: string;
  generatedAt: string;
}

export interface AppData {
  settings: SchoolSettings;
  teachers: Teacher[];
  students: Student[];
  rooms: Room[];
  lessons: Lesson[];
  lessonSeries: LessonSeries[];
  attendances: Attendance[];
  makeupRequests: MakeupRequest[];
  payments: Payment[];
  teacherFeeRules: TeacherFeeRule[];
  teacherPayouts: TeacherPayout[];
}

/**
 * EPIC 6B (IMPLEMENTATION_PLAN.md) — öğretmenin bir öğrenciye verdiği ödev.
 * `AppData`'nın dışında, standalone modül olarak tutulur (bkz.
 * src/lib/homework.ts) — Notification/Announcement/LessonAssessment ile
 * aynı desen.
 */
export interface Homework {
  id: string;
  teacherId: string;
  studentId: string;
  title: string;
  description: string;
  /** ISO tarih */
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dosya içeriği küçük dosya/foto/kısa video için base64 olarak taşınır
 * (bkz. Homework modelinin şema yorumu). Erişim yalnızca oturum + sahiplik
 * kontrolüyle yapılan bir API rotası üzerinden yapılır, asla ham bir
 * herkese açık URL ile değil.
 */
export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  note?: string;
  fileName?: string;
  fileMimeType?: string;
  /** Yalnızca base64 gövde — yanıtlarda genelde eksiltilip yalnızca "dosya var mı" bilgisi taşınır. */
  fileData?: string;
  submittedAt: string;
  teacherFeedback?: string;
  reviewedAt?: string;
}

/**
 * EPIC 6B — öğretmenin öğrenci türü/enstrüman/seviyeye (EPIC 4 alanları)
 * hedefleyerek paylaştığı materyal/pratik videosu. Hedefleme alanlarının
 * HEPSİ undefined ise öğretmenin TÜM öğrencilerine görünür.
 */
export interface TeachingMaterial {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  targetStudentType?: StudentType;
  targetInstrument?: Instrument;
  targetLevel?: string;
  fileName?: string;
  fileMimeType?: string;
  fileData?: string;
  createdAt: string;
}

/**
 * EPIC 6C (IMPLEMENTATION_PLAN.md) — veli/öğrencinin öğretmen hakkında
 * yapılandırılmış geri bildirimi. Kamuya açık ortalama/sıralama YOK.
 */
export type TeacherFeedbackStatus = "pending" | "reviewed" | "actioned";

export interface TeacherFeedback {
  id: string;
  teacherId: string;
  studentId: string;
  submittedBy: string;
  submitterRole: string;
  scores: Record<string, number>;
  comment?: string;
  status: TeacherFeedbackStatus;
  createdAt: string;
}
