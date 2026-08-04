import type { AppData, BranchId, Instrument, StudentType } from "./types";
import { addDays, setHours, setMinutes, startOfDay, formatISO } from "date-fns";
import { DEFAULT_TENANT_ID } from "./auth/config";

function at(dayOffset: number, hour: number, minute = 0) {
  const base = startOfDay(new Date());
  const d = setMinutes(setHours(addDays(base, dayOffset), hour), minute);
  return formatISO(d);
}

function end(startIso: string, minutes = 45) {
  return formatISO(new Date(new Date(startIso).getTime() + minutes * 60 * 1000));
}

/** Demo: Nilüfer Acar Müzik Akademisi — Erzene + Evka 3 */
export function createSeedData(): AppData {
  const branches = [
    {
      id: "erzene" as const,
      name: "Erzene Şubesi (Merkez)",
      shortName: "Erzene",
      address: "Erzene Mahallesi Türkeli Caddesi No:18/A Bornova / İzmir (Gençlik Park Sokağı)",
      phone: "0553 848 16 58",
      city: "İzmir",
    },
    {
      id: "evka3" as const,
      name: "Evka 3 Şubesi",
      shortName: "Evka 3",
      address: "Evka 3, Bornova / İzmir",
      phone: "0553 848 16 58",
      city: "İzmir",
    },
  ];

  const teachers = [
    {
      id: "t1",
      name: "Nilüfer Acar",
      email: "merhaba@niluferacar.com.tr",
      phone: "0553 848 16 58",
      branchId: "erzene" as BranchId,
      instruments: ["Piyano", "Şan"] as Instrument[],
      availability: [
        { dayOfWeek: 1, start: "10:00", end: "19:00" },
        { dayOfWeek: 2, start: "10:00", end: "19:00" },
        { dayOfWeek: 3, start: "10:00", end: "19:00" },
        { dayOfWeek: 4, start: "10:00", end: "19:00" },
        { dayOfWeek: 5, start: "10:00", end: "18:00" },
        { dayOfWeek: 6, start: "10:00", end: "14:00" },
      ],
      maxDailyLessons: 8,
      active: true,
      color: "#7c3aed",
    },
    {
      id: "t2",
      name: "Can Yılmaz",
      email: "can@niluferacar.com.tr",
      phone: "0532 111 2233",
      branchId: "erzene" as BranchId,
      instruments: ["Gitar"] as Instrument[],
      availability: [
        { dayOfWeek: 1, start: "12:00", end: "20:00" },
        { dayOfWeek: 2, start: "12:00", end: "20:00" },
        { dayOfWeek: 3, start: "12:00", end: "20:00" },
        { dayOfWeek: 4, start: "12:00", end: "20:00" },
        { dayOfWeek: 5, start: "12:00", end: "18:00" },
        { dayOfWeek: 6, start: "11:00", end: "15:00" },
      ],
      maxDailyLessons: 7,
      active: true,
      color: "#0891b2",
    },
    {
      id: "t3",
      name: "Elif Kaya",
      email: "elif@niluferacar.com.tr",
      phone: "0533 444 5566",
      branchId: "evka3" as BranchId,
      instruments: ["Keman", "Yan Flüt"] as Instrument[],
      availability: [
        { dayOfWeek: 1, start: "09:00", end: "17:00" },
        { dayOfWeek: 2, start: "09:00", end: "17:00" },
        { dayOfWeek: 3, start: "09:00", end: "17:00" },
        { dayOfWeek: 4, start: "09:00", end: "17:00" },
        { dayOfWeek: 5, start: "09:00", end: "15:00" },
      ],
      maxDailyLessons: 8,
      active: true,
      color: "#db2777",
    },
    {
      id: "t4",
      name: "Mert Öztürk",
      email: "mert@niluferacar.com.tr",
      phone: "0535 777 8899",
      branchId: "evka3" as BranchId,
      instruments: ["Bateri"] as Instrument[],
      availability: [
        { dayOfWeek: 2, start: "14:00", end: "21:00" },
        { dayOfWeek: 3, start: "14:00", end: "21:00" },
        { dayOfWeek: 4, start: "14:00", end: "21:00" },
        { dayOfWeek: 5, start: "14:00", end: "21:00" },
        { dayOfWeek: 6, start: "10:00", end: "16:00" },
      ],
      maxDailyLessons: 6,
      active: true,
      color: "#ea580c",
    },
    {
      id: "t5",
      name: "Ayşe Demir",
      email: "ayse@niluferacar.com.tr",
      phone: "0536 222 3344",
      branchId: "erzene" as BranchId,
      instruments: ["Piyano", "Yan Flüt"] as Instrument[],
      availability: [
        { dayOfWeek: 1, start: "10:00", end: "18:00" },
        { dayOfWeek: 3, start: "10:00", end: "18:00" },
        { dayOfWeek: 5, start: "10:00", end: "18:00" },
        { dayOfWeek: 6, start: "10:00", end: "14:00" },
      ],
      maxDailyLessons: 7,
      active: true,
      color: "#059669",
    },
  ];

  const rooms = [
    { id: "r1", name: "Stüdyo 1 — Piyano", branchId: "erzene" as BranchId, capacity: 2, instruments: ["Piyano", "Şan"] as Instrument[] },
    { id: "r2", name: "Stüdyo 2 — Gitar", branchId: "erzene" as BranchId, capacity: 2, instruments: ["Gitar"] as Instrument[] },
    { id: "r3", name: "Stüdyo 3 — Flüt/Keman", branchId: "erzene" as BranchId, capacity: 2, instruments: ["Yan Flüt", "Keman"] as Instrument[] },
    { id: "r4", name: "Stüdyo A — Piyano", branchId: "evka3" as BranchId, capacity: 2, instruments: ["Piyano", "Şan"] as Instrument[] },
    { id: "r5", name: "Stüdyo B — Yaylı", branchId: "evka3" as BranchId, capacity: 2, instruments: ["Keman", "Yan Flüt"] as Instrument[] },
    { id: "r6", name: "Stüdyo C — Ritim", branchId: "evka3" as BranchId, capacity: 3, instruments: ["Bateri"] as Instrument[] },
  ];

  const students = [
    {
      id: "s1",
      name: "Zeynep Arslan",
      email: "zeynep@email.com",
      phone: "0541 100 0101",
      parentName: "Selin Arslan",
      parentPhone: "0541 100 0102",
      branchId: "erzene" as BranchId,
      instruments: ["Piyano"] as Instrument[],
      teacherId: "t1",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3200,
      active: true,
      notes: "Piyano başlangıç+",
      createdAt: at(-90, 10),
      studentType: "Hobi" as StudentType,
      enrollmentStartDate: at(-90, 10),
    },
    {
      id: "s2",
      name: "Emir Çelik",
      email: "emir@email.com",
      phone: "0542 200 0202",
      parentName: "Hakan Çelik",
      parentPhone: "0542 200 0203",
      branchId: "erzene" as BranchId,
      instruments: ["Gitar"] as Instrument[],
      teacherId: "t2",
      packageName: "Bireysel Aylık — 8 ders",
      weeklyLessonCount: 2,
      monthlyFee: 5600,
      active: true,
      notes: "Akustik gitar",
      createdAt: at(-60, 11),
      studentType: "MEB" as StudentType,
      enrollmentStartDate: at(-60, 11),
      level: "Orta",
    },
    {
      id: "s3",
      name: "Defne Şahin",
      email: "defne@email.com",
      phone: "0543 300 0303",
      parentName: "Ayhan Şahin",
      parentPhone: "0543 300 0304",
      branchId: "evka3" as BranchId,
      instruments: ["Keman"] as Instrument[],
      teacherId: "t3",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3400,
      active: true,
      notes: "",
      createdAt: at(-45, 9),
      studentType: "Konservatuvar Hazırlık" as StudentType,
      enrollmentStartDate: at(-45, 9),
      level: "İleri",
      targetExam: "2027 Konservatuvar giriş sınavı",
    },
    {
      id: "s4",
      name: "Ali Koç",
      email: "ali@email.com",
      phone: "0544 400 0404",
      parentName: "Mehmet Koç",
      parentPhone: "0544 400 0405",
      branchId: "evka3" as BranchId,
      instruments: ["Bateri"] as Instrument[],
      teacherId: "t4",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3000,
      active: true,
      notes: "Rock tempo",
      createdAt: at(-30, 14),
      studentType: "Hobi" as StudentType,
      enrollmentStartDate: at(-30, 14),
    },
    {
      id: "s5",
      name: "Lara Yıldız",
      email: "lara@email.com",
      phone: "0545 500 0505",
      parentName: "Deniz Yıldız",
      parentPhone: "0545 500 0506",
      branchId: "erzene" as BranchId,
      instruments: ["Şan"] as Instrument[],
      teacherId: "t1",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3600,
      active: true,
      notes: "Pop vokal",
      createdAt: at(-20, 12),
      studentType: "Güzel Sanatlar Lisesi Hazırlık" as StudentType,
      enrollmentStartDate: at(-20, 12),
      targetExam: "2026 GSL yetenek sınavı",
    },
    {
      id: "s6",
      name: "Burak Aydın",
      email: "burak@email.com",
      phone: "0546 600 0606",
      parentName: "Gül Aydın",
      parentPhone: "0546 600 0607",
      branchId: "erzene" as BranchId,
      instruments: ["Gitar"] as Instrument[],
      teacherId: "t2",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3000,
      active: true,
      notes: "",
      createdAt: at(-15, 16),
      studentType: "Hobi" as StudentType,
      enrollmentStartDate: at(-15, 16),
    },
    {
      id: "s7",
      name: "İpek Demirtaş",
      email: "ipek@email.com",
      phone: "0547 700 0707",
      parentName: "Serkan Demirtaş",
      parentPhone: "0547 700 0708",
      branchId: "evka3" as BranchId,
      instruments: ["Yan Flüt"] as Instrument[],
      teacherId: "t3",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3200,
      active: true,
      notes: "",
      createdAt: at(-10, 10),
      studentType: "London College of Music Hazırlık" as StudentType,
      enrollmentStartDate: at(-10, 10),
      level: "Başlangıç",
    },
    {
      id: "s8",
      name: "Kaan Ersoy",
      email: "kaan@email.com",
      phone: "0548 800 0808",
      parentName: "Nil Ersoy",
      parentPhone: "0548 800 0809",
      branchId: "erzene" as BranchId,
      instruments: ["Piyano"] as Instrument[],
      teacherId: "t5",
      packageName: "Bireysel Aylık — 8 ders",
      weeklyLessonCount: 2,
      monthlyFee: 5800,
      active: true,
      notes: "Başlangıç",
      createdAt: at(-5, 11),
      studentType: "MEB" as StudentType,
      enrollmentStartDate: at(-5, 11),
    },
  ];

  type LDef = {
    id: string;
    studentId: string;
    teacherId: string;
    roomId: string;
    branchId: BranchId;
    instrument: Instrument;
    day: number;
    hour: number;
    status?: "scheduled" | "completed" | "cancelled" | "no_show";
  };

  const lessonDefs: LDef[] = [
    { id: "l1", studentId: "s1", teacherId: "t1", roomId: "r1", branchId: "erzene", instrument: "Piyano", day: -7, hour: 14, status: "completed" },
    { id: "l2", studentId: "s2", teacherId: "t2", roomId: "r2", branchId: "erzene", instrument: "Gitar", day: -6, hour: 16, status: "no_show" },
    { id: "l3", studentId: "s3", teacherId: "t3", roomId: "r5", branchId: "evka3", instrument: "Keman", day: -5, hour: 11, status: "completed" },
    { id: "l4", studentId: "s4", teacherId: "t4", roomId: "r6", branchId: "evka3", instrument: "Bateri", day: -4, hour: 17, status: "cancelled" },
    { id: "l5", studentId: "s5", teacherId: "t1", roomId: "r1", branchId: "erzene", instrument: "Şan", day: -3, hour: 15, status: "no_show" },
    { id: "l6", studentId: "s6", teacherId: "t2", roomId: "r2", branchId: "erzene", instrument: "Gitar", day: -2, hour: 18, status: "completed" },
    { id: "l7", studentId: "s1", teacherId: "t1", roomId: "r1", branchId: "erzene", instrument: "Piyano", day: -1, hour: 14, status: "completed" },
    { id: "l8", studentId: "s2", teacherId: "t2", roomId: "r2", branchId: "erzene", instrument: "Gitar", day: 0, hour: 16 },
    { id: "l9", studentId: "s7", teacherId: "t3", roomId: "r5", branchId: "evka3", instrument: "Yan Flüt", day: 0, hour: 11 },
    { id: "l10", studentId: "s8", teacherId: "t5", roomId: "r1", branchId: "erzene", instrument: "Piyano", day: 0, hour: 12 },
    { id: "l11", studentId: "s4", teacherId: "t4", roomId: "r6", branchId: "evka3", instrument: "Bateri", day: 0, hour: 18 },
    { id: "l12", studentId: "s1", teacherId: "t1", roomId: "r1", branchId: "erzene", instrument: "Piyano", day: 1, hour: 14 },
    { id: "l13", studentId: "s3", teacherId: "t3", roomId: "r5", branchId: "evka3", instrument: "Keman", day: 2, hour: 11 },
    { id: "l14", studentId: "s5", teacherId: "t1", roomId: "r1", branchId: "erzene", instrument: "Şan", day: 2, hour: 15 },
    { id: "l15", studentId: "s2", teacherId: "t2", roomId: "r2", branchId: "erzene", instrument: "Gitar", day: 3, hour: 16 },
    { id: "l16", studentId: "s6", teacherId: "t2", roomId: "r2", branchId: "erzene", instrument: "Gitar", day: 3, hour: 18 },
    { id: "l17", studentId: "s8", teacherId: "t5", roomId: "r1", branchId: "erzene", instrument: "Piyano", day: 4, hour: 12 },
    { id: "l18", studentId: "s7", teacherId: "t3", roomId: "r5", branchId: "evka3", instrument: "Yan Flüt", day: 4, hour: 10 },
    { id: "l19", studentId: "s4", teacherId: "t4", roomId: "r6", branchId: "evka3", instrument: "Bateri", day: 5, hour: 17 },
    { id: "l20", studentId: "s3", teacherId: "t3", roomId: "r5", branchId: "evka3", instrument: "Keman", day: 6, hour: 11 },
  ];

  const lessons = lessonDefs.map((d) => {
    const startAt = at(d.day, d.hour);
    return {
      id: d.id,
      studentId: d.studentId,
      teacherId: d.teacherId,
      roomId: d.roomId,
      branchId: d.branchId,
      instrument: d.instrument,
      startAt,
      endAt: end(startAt),
      type: "regular" as const,
      status: (d.status ?? "scheduled") as "scheduled" | "completed" | "cancelled" | "no_show",
    };
  });

  const attendances = [
    { id: "a1", lessonId: "l1", studentId: "s1", status: "present" as const, markedAt: at(-7, 14, 5), createsMakeupCredit: false },
    { id: "a2", lessonId: "l2", studentId: "s2", status: "absent" as const, reason: "Hasta (veli bildirdi)", markedAt: at(-6, 16, 10), createsMakeupCredit: true },
    { id: "a3", lessonId: "l3", studentId: "s3", status: "present" as const, markedAt: at(-5, 11, 2), createsMakeupCredit: false },
    { id: "a4", lessonId: "l4", studentId: "s4", status: "cancelled_by_school" as const, reason: "Öğretmen hastalık izni", markedAt: at(-4, 9), createsMakeupCredit: true },
    { id: "a5", lessonId: "l5", studentId: "s5", status: "absent" as const, reason: "Sınav çakışması", markedAt: at(-3, 15, 15), createsMakeupCredit: true },
    { id: "a6", lessonId: "l6", studentId: "s6", status: "present" as const, markedAt: at(-2, 18), createsMakeupCredit: false },
    { id: "a7", lessonId: "l7", studentId: "s1", status: "present" as const, markedAt: at(-1, 14), createsMakeupCredit: false },
  ];

  const makeupRequests = [
    {
      id: "m1",
      studentId: "s2",
      teacherId: "t2",
      branchId: "erzene" as BranchId,
      instrument: "Gitar" as Instrument,
      sourceLessonId: "l2",
      attendanceId: "a2",
      status: "pending" as const,
      reason: "Hasta (veli bildirdi)",
      expiresAt: at(8, 23, 59),
      suggestedSlots: [],
      createdAt: at(-6, 16, 15),
      policyNote: "14 gün içinde kullanılmalı · aynı öğretmen tercih edilir · Erzene şubesi",
    },
    {
      id: "m2",
      studentId: "s4",
      teacherId: "t4",
      branchId: "evka3" as BranchId,
      instrument: "Bateri" as Instrument,
      sourceLessonId: "l4",
      attendanceId: "a4",
      status: "pending" as const,
      reason: "Öğretmen hastalık izni",
      expiresAt: at(10, 23, 59),
      suggestedSlots: [],
      createdAt: at(-4, 9, 5),
      policyNote: "Okul kaynaklı iptal — öncelikli yerleştirme · Evka 3",
    },
    {
      id: "m3",
      studentId: "s5",
      teacherId: "t1",
      branchId: "erzene" as BranchId,
      instrument: "Şan" as Instrument,
      sourceLessonId: "l5",
      attendanceId: "a5",
      status: "pending" as const,
      reason: "Sınav çakışması",
      expiresAt: at(11, 23, 59),
      suggestedSlots: [],
      createdAt: at(-3, 15, 20),
      policyNote: "14 gün içinde kullanılmalı · aynı öğretmen tercih edilir · Erzene şubesi",
    },
  ];

  const payments = [
    { id: "p1", studentId: "s1", amount: 3200, paidAmount: 3200, status: "paid" as const, dueDate: at(-5, 0), paidAt: at(-6, 12), description: "Temmuz 2026 — Piyano (Erzene)", method: "Havale" },
    { id: "p2", studentId: "s2", amount: 5600, paidAmount: 5600, status: "paid" as const, dueDate: at(-5, 0), paidAt: at(-4, 10), description: "Temmuz 2026 — Gitar 8 ders (Erzene)", method: "Kredi kartı" },
    { id: "p3", studentId: "s3", amount: 3400, paidAmount: 0, status: "pending" as const, dueDate: at(3, 0), description: "Temmuz 2026 — Keman (Evka 3)" },
    { id: "p4", studentId: "s4", amount: 3000, paidAmount: 1500, status: "partial" as const, dueDate: at(-2, 0), paidAt: at(-2, 14), description: "Temmuz 2026 — Bateri (Evka 3)", method: "Nakit" },
    { id: "p5", studentId: "s5", amount: 3600, paidAmount: 0, status: "overdue" as const, dueDate: at(-3, 0), description: "Temmuz 2026 — Şan (Erzene)" },
    { id: "p6", studentId: "s6", amount: 3000, paidAmount: 3000, status: "paid" as const, dueDate: at(-1, 0), paidAt: at(-1, 9), description: "Temmuz 2026 — Gitar (Erzene)", method: "Havale" },
    { id: "p7", studentId: "s7", amount: 3200, paidAmount: 0, status: "pending" as const, dueDate: at(5, 0), description: "Temmuz 2026 — Yan Flüt (Evka 3)" },
    { id: "p8", studentId: "s8", amount: 5800, paidAmount: 0, status: "pending" as const, dueDate: at(2, 0), description: "Temmuz 2026 — Piyano 8 ders (Erzene)" },
  ];

  // Her mevcut demo öğretmen için taban dakika ücreti — teacherId-only kapsam
  // (şube/enstrüman daraltması yok), 2020-01-01'den itibaren açık uçlu.
  // Sabit geçmiş tarih kasıtlı: seed dersleri "bugüne göre" göreli üretilir
  // (bkz. `at()`), bu yüzden gerçek takvim tarihinden bağımsız olarak her
  // zaman tüm seed derslerinden önce kalır.
  const teacherFeeRules = teachers.map((t) => ({
    id: `fee_${t.id}`,
    teacherId: t.id,
    perMinuteRate: 11.5,
    effectiveFrom: "2020-01-01",
    createdAt: at(-90, 8),
  }));

  return {
    settings: {
      tenantId: DEFAULT_TENANT_ID,
      name: "Nilüfer Acar Müzik Akademisi",
      shortName: "Nilüfer Acar",
      city: "İzmir",
      website: "https://www.niluferacar.com.tr",
      email: "merhaba@niluferacar.com.tr",
      phone: "0553 848 16 58",
      logoUrl: "https://www.niluferacar.com.tr/storage/settings/November2024/Ri2OWV2c9tRR3e3fAoWt.png",
      makeupWindowDays: 14,
      lessonDurationMinutes: 45,
      workingHours: { start: "09:00", end: "21:00" },
      workingDays: [1, 2, 3, 4, 5, 6],
      currency: "TRY",
      feeRoundingMode: "exact_minutes",
      branches,
    },
    teachers,
    students,
    rooms,
    lessons,
    lessonSeries: [],
    attendances,
    makeupRequests,
    payments,
    teacherFeeRules,
    teacherPayouts: [],
  };
}
