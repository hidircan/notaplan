/**
 * Geldi / İşlendi / Telafi — ayrı, kalıcı operasyonel bayraklar (tek enum değil).
 * - Geldi: öğrenci katıldı; dersi otomatik tamamlamaz
 * - İşlendi: ders fiilen işlendi → hakediş kaynağı (status completed)
 * - Telafi: telafi akışına alındı (kırmızı)
 *
 * Mali entegrasyon (ÖNCELİK 3): Geldi VEYA İşlendi ilk kez işaretlendiğinde
 * (`alreadySet:false`), o dersin KENDİ lessonId'si için — henüz yoksa —
 * otomatik bir öğrenci tahsilatı (Payment, source:"lesson_ops") oluşturulur.
 * Aynı ders için ikinci bir tetik (ör. önce Geldi, sonra İşlendi, ya da
 * tekrar tıklama) `data.payments`'ta o lessonId için zaten bir kayıt olup
 * olmadığını kontrol ederek mükerrer tahsilatı engeller. Öğretmen hakedişi
 * tarafı zaten `isLessonProcessedForPayout` + `computeTeacherEarningsForPeriod`
 * üzerinden dersin kendi lessonId'sine göre TEK SEFER hesaplanıyor — o
 * mekanizmaya dokunulmadı, yalnızca öğrenci tahsilatı tarafı eklendi.
 * Telafi (`opsMakeupFlag`) TEK BAŞINA hiçbir mali kayıt yaratmaz (varsayılan
 * `collectionsSettings.telafiChargesOnFlag=false`); yeni bir telafi dersi
 * fiilen gerçekleştiğinde o dersin KENDİ Geldi/İşlendi işaretlemesi aynı
 * mekanizmadan geçer — özel bir kod yolu gerekmez.
 */

import type { AppData, Attendance, Lesson, MakeupRequest, Payment, Student } from "./types";
import { uid, formatMoney } from "./utils";
import { addDays, formatISO } from "date-fns";
import { dueWindowForPaymentMethod } from "./collections-due";

/** Yıllık ortalama hafta sayısı (52/12) — aylık ücreti haftalık/ders başı tutara çevirmek için. */
const AVG_WEEKS_PER_MONTH = 52 / 12;

/**
 * Bir dersin öğrenciye yansıyacak ücreti — öğrencinin aylık paket ücreti,
 * haftalık ders sayısına ve ortalama ay-başına-hafta sayısına bölünerek
 * türetilir (kayıt sırasında girilen aylık ücret esas alınır; derse özel
 * ayrı bir ücret alanı yok). Tam TL'ye yuvarlanır (kuruş hassasiyeti yok —
 * mevcut Payment.amount zaten integer TL).
 */
export function computeLessonChargeAmount(
  student: Pick<Student, "monthlyFee" | "weeklyLessonCount">
): number {
  if (!student.weeklyLessonCount || student.weeklyLessonCount <= 0) return Math.round(student.monthlyFee);
  const perLesson = student.monthlyFee / (student.weeklyLessonCount * AVG_WEEKS_PER_MONTH);
  return Math.max(Math.round(perLesson), 0);
}

/**
 * Ders bazlı otomatik tahsilatın vadesi — öğrencinin ödeme yöntemine göre
 * mevcut vade penceresi kuralı (PRODUCT_BACKLOG §2.1), dersin gerçekleştiği
 * ayın içinde uygulanır. `paymentDueDay` set edilmişse (ve pencere içindeyse)
 * o gün kullanılır; yoksa pencerenin son günü.
 */
function resolveLessonPaymentDueDate(
  student: Pick<Student, "paymentMethod" | "paymentDueDay">,
  lessonStartAt: string
): string {
  const lessonDate = new Date(lessonStartAt);
  const window = dueWindowForPaymentMethod(student.paymentMethod);
  const day =
    student.paymentDueDay && student.paymentDueDay >= window.minDay && student.paymentDueDay <= window.maxDay
      ? student.paymentDueDay
      : window.maxDay;
  const due = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), day, 12, 0, 0);
  return due.toISOString();
}

/**
 * Geldi/İşlendi ile tetiklenen otomatik öğrenci tahsilatı — bu dersin
 * lessonId'si için `data.payments`'ta ZATEN bir kayıt varsa (source fark
 * etmeksizin) hiçbir şey yapmaz (çift tahsilat engeli). Öğrenci bulunamazsa
 * sessizce atlar (yoklama akışını asla bloklamaz — mali kayıt ikincil bir
 * yan etkidir, ana işlemi asla başarısız kılmamalı).
 */
function createLessonPaymentIfMissing(data: AppData, lesson: Lesson, now: Date): AppData {
  if (data.payments.some((p) => p.lessonId === lesson.id)) return data;
  const student = data.students.find((s) => s.id === lesson.studentId);
  if (!student) return data;

  const amount = computeLessonChargeAmount(student);
  const dueDate = resolveLessonPaymentDueDate(student, lesson.startAt);
  const payment: Payment = {
    id: uid("pay"),
    studentId: student.id,
    amount,
    paidAmount: 0,
    status: new Date(dueDate) < now ? "overdue" : "pending",
    dueDate,
    description: `Ders ücreti — ${formatMoney(amount)} (${new Date(lesson.startAt).toLocaleDateString("tr-TR")})`,
    lessonId: lesson.id,
    source: "lesson_ops",
    createdAt: now.toISOString(),
  };
  return { ...data, payments: [...data.payments, payment] };
}

export type LessonOpsFlag = "attended" | "processed" | "makeup";

export type LessonOpsPatch = Partial<
  Pick<
    Lesson,
    | "studentAttended"
    | "studentAttendedAt"
    | "studentAttendedBy"
    | "lessonProcessed"
    | "lessonProcessedAt"
    | "lessonProcessedBy"
    | "opsMakeupFlag"
    | "opsMakeupFlagAt"
    | "opsMakeupFlagBy"
    | "status"
    | "actualEndAt"
  >
>;

export type ApplyLessonOpsResult =
  | {
      ok: true;
      alreadySet: boolean;
      data: AppData;
      lesson: Lesson;
      message: string;
    }
  | { ok: false; message: string };

export function isLessonProcessedForPayout(lesson: Pick<Lesson, "status" | "lessonProcessed">): boolean {
  // İşlendi bayrağı birincil; yoksa legacy completed
  if (lesson.lessonProcessed === true) return true;
  if (lesson.lessonProcessed === false) return false;
  return lesson.status === "completed";
}

export function applyLessonOpsFlag(
  data: AppData,
  lessonId: string,
  flag: LessonOpsFlag,
  actorUserId: string,
  now: Date = new Date()
): ApplyLessonOpsResult {
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson) return { ok: false, message: "Ders bulunamadı." };

  const nowIso = now.toISOString();

  if (flag === "attended") {
    if (lesson.studentAttended) {
      return {
        ok: true,
        alreadySet: true,
        data,
        lesson,
        message: "Geldi zaten işaretli.",
      };
    }
    const patch: LessonOpsPatch = {
      studentAttended: true,
      studentAttendedAt: nowIso,
      studentAttendedBy: actorUserId,
    };
    let attendances = data.attendances.filter((a) => a.lessonId !== lessonId);
    const attendance: Attendance = {
      id: uid("att"),
      lessonId,
      studentId: lesson.studentId,
      status: "present",
      markedAt: nowIso,
      createsMakeupCredit: false,
    };
    attendances = [...attendances, attendance];
    const lessons = data.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l));
    let next = { ...data, lessons, attendances };
    const nextLesson = lessons.find((l) => l.id === lessonId)!;
    next = createLessonPaymentIfMissing(next, nextLesson, now);
    return {
      ok: true,
      alreadySet: false,
      data: next,
      lesson: nextLesson,
      message: "Geldi işaretlendi.",
    };
  }

  if (flag === "processed") {
    if (lesson.lessonProcessed && lesson.status === "completed") {
      return {
        ok: true,
        alreadySet: true,
        data,
        lesson,
        message: "İşlendi zaten işaretli.",
      };
    }
    const patch: LessonOpsPatch = {
      lessonProcessed: true,
      lessonProcessedAt: nowIso,
      lessonProcessedBy: actorUserId,
      status: "completed",
      actualEndAt: lesson.actualEndAt ?? nowIso,
    };
    const lessons = data.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l));
    let next = { ...data, lessons };
    const nextLesson = lessons.find((l) => l.id === lessonId)!;
    next = createLessonPaymentIfMissing(next, nextLesson, now);
    return {
      ok: true,
      alreadySet: false,
      data: next,
      lesson: nextLesson,
      message: "İşlendi işaretlendi.",
    };
  }

  // makeup
  if (lesson.opsMakeupFlag) {
    return {
      ok: true,
      alreadySet: true,
      data,
      lesson,
      message: "Telafi zaten işaretli.",
    };
  }
  const patch: LessonOpsPatch = {
    opsMakeupFlag: true,
    opsMakeupFlagAt: nowIso,
    opsMakeupFlagBy: actorUserId,
  };
  const lessons = data.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l));

  let makeupRequests = data.makeupRequests;
  const existingMk = makeupRequests.find(
    (m) => m.sourceLessonId === lessonId && m.status !== "cancelled" && m.status !== "expired"
  );
  if (!existingMk) {
    const branch = data.settings.branches.find((b) => b.id === lesson.branchId);
    const req: MakeupRequest = {
      id: uid("mk"),
      studentId: lesson.studentId,
      teacherId: lesson.teacherId,
      branchId: lesson.branchId,
      instrument: lesson.instrument,
      sourceLessonId: lesson.id,
      attendanceId: data.attendances.find((a) => a.lessonId === lessonId)?.id ?? uid("att"),
      status: "pending",
      reason: "Program/yoklama — Telafi işaretlendi",
      expiresAt: formatISO(addDays(now, data.settings.makeupWindowDays)),
      suggestedSlots: [],
      createdAt: nowIso,
      policyNote: `${data.settings.makeupWindowDays} gün · ${branch?.shortName ?? ""}`,
    };
    makeupRequests = [...makeupRequests, req];
  }

  let next = { ...data, lessons, makeupRequests };
  const nextLesson = lessons.find((l) => l.id === lessonId)!;
  // Varsayılan: Telafi işareti TEK BAŞINA mali sonuç doğurmaz. Yönetici bu
  // davranışı sistem ayarından (Ücret Kuralları > Tahsilat Otomasyonu)
  // bilinçli olarak açtıysa, telafi işaretinin kendisi de bu dersin
  // lessonId'si için hemen bir tahsilat oluşturur.
  if (data.settings.collectionsSettings?.telafiChargesOnFlag) {
    next = createLessonPaymentIfMissing(next, nextLesson, now);
  }
  return {
    ok: true,
    alreadySet: false,
    data: next,
    lesson: nextLesson,
    message: "Telafi işaretlendi.",
  };
}

/** Bir dersin o an "etkin" tek statüsü — öncelik: İşlendi > Geldi > Telafi. */
export function effectiveLessonOpsStatus(
  lesson: Pick<Lesson, "studentAttended" | "lessonProcessed" | "opsMakeupFlag">
): LessonOpsFlag | null {
  if (lesson.lessonProcessed) return "processed";
  if (lesson.studentAttended) return "attended";
  if (lesson.opsMakeupFlag) return "makeup";
  return null;
}

/**
 * ÖNCELİK 4 (devam) — Geldi/İşlendi/Telafi'yi TEK, birbirini dışlayan bir
 * statü olarak davranmasını sağlar. Halihazırda farklı bir statü etkinse
 * (`effectiveLessonOpsStatus` ile), önce O statünün bayrağını (ve varsa
 * diğerlerini) TEMİZLER, sonra istenen bayrağı `applyLessonOpsFlag` ile —
 * DEĞİŞMEDEN, aynı mali entegrasyon davranışıyla — set eder. Bilinçli
 * tasarım kararı: daha önce oluşmuş bir Payment (`source:"lesson_ops"`)
 * asla burada iptal/void EDİLMEZ — yalnızca ders iptali (`applyLessonCancel`)
 * ödemeyi void yapar. Statü değişince eski ödeme öylece kalır (çift kayıt
 * oluşturulmaz — `createLessonPaymentIfMissing` lessonId üzerinden zaten
 * idempotent); bu, mevcut tahsilat/void/audit akışını bozmadan en güvenli
 * davranıştır.
 */
export function switchLessonOpsFlag(
  data: AppData,
  lessonId: string,
  flag: LessonOpsFlag,
  actorUserId: string,
  now: Date = new Date()
): ApplyLessonOpsResult {
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson) return { ok: false, message: "Ders bulunamadı." };

  const current = effectiveLessonOpsStatus(lesson);
  if (current === flag) {
    // Zaten bu statüde — applyLessonOpsFlag kendi "alreadySet" mesajını üretir.
    return applyLessonOpsFlag(data, lessonId, flag, actorUserId, now);
  }
  if (current === null) {
    // Hiçbir statü etkin değil — ilk tıklama, doğrudan set.
    return applyLessonOpsFlag(data, lessonId, flag, actorUserId, now);
  }

  // Farklı bir statüden geçiş — önce diğer bayrakları temizle (mali kayıt DOKUNULMAZ).
  const cleared: Lesson = {
    ...lesson,
    studentAttended: false,
    studentAttendedAt: undefined,
    studentAttendedBy: undefined,
    lessonProcessed: false,
    lessonProcessedAt: undefined,
    lessonProcessedBy: undefined,
    opsMakeupFlag: false,
    opsMakeupFlagAt: undefined,
    opsMakeupFlagBy: undefined,
  };
  const clearedData: AppData = {
    ...data,
    lessons: data.lessons.map((l) => (l.id === lessonId ? cleared : l)),
  };
  return applyLessonOpsFlag(clearedData, lessonId, flag, actorUserId, now);
}
