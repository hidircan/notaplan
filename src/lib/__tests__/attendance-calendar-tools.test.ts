import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  createLessonTool,
  createStudentTool,
  setLessonOpsFlagTool,
  setMonthlyPlanAmountTool,
  setDayOverrideTool,
  getAttendanceCalendarMonthTool,
  updateStudentProfileTool,
} from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";
import { validateLessonSlot } from "../makeup-engine";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");
const CLOSED_DAYS_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "closed-days.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "SCHOOL_ADMIN",
    userId: "u1",
    tenantId: DEFAULT_TENANT_ID,
    channel: "web",
    ...overrides,
  };
}

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  await fs.rm(CLOSED_DAYS_FILE, { force: true });
});

async function findOpenSlot(): Promise<string> {
  const data = await readData();
  for (let offset = 1; offset <= 14; offset++) {
    for (let hour = 9; hour <= 16; hour++) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      d.setHours(hour, 0, 0, 0);
      if (d.getDay() === 1) continue; // Pazartesi zaten yasak
      const candidate = d.toISOString();
      const check = validateLessonSlot(
        data,
        { instrument: "Piyano", studentId: "s1" },
        { teacherId: "t1", roomId: "r1", startAt: candidate }
      );
      if (check.ok) return candidate;
    }
  }
  throw new Error("no open slot found");
}

async function createTestLesson(): Promise<string> {
  const startAt = await findOpenSlot();
  const res = await createLessonTool(ctx(), {
    studentId: "s1",
    teacherId: "t1",
    roomId: "r1",
    instrument: "Piyano",
    startAt,
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data.lessonId;
}

describe("ÖNCELİK 4 — kapalı gün mali/yoklama gate", () => {
  it("admin manuel kapalı gün işaretlerse o günün dersinde Geldi/İşlendi engellenir, mali kayıt oluşmaz", async () => {
    const lessonId = await createTestLesson();
    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const dateYmd = lesson.startAt.slice(0, 10);

    const overrideRes = await setDayOverrideTool(ctx(), {
      date: dateYmd,
      isOpen: false,
      name: "Test kapalı gün",
    });
    expect(overrideRes.ok).toBe(true);

    const flagRes = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    expect(flagRes.ok).toBe(false);

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(0);
  });

  it("zorla-açık istisna, resmî tatil/haftalık kuralın önüne geçerek işlemi serbest bırakır", async () => {
    const lessonId = await createTestLesson();
    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const dateYmd = lesson.startAt.slice(0, 10);

    // önce kapat, sonra zorla aç (upsert — aynı tarih tek kayıt)
    await setDayOverrideTool(ctx(), { date: dateYmd, isOpen: false, name: "Kapalı" });
    await setDayOverrideTool(ctx(), { date: dateYmd, isOpen: true, name: "Zorla açık" });

    const flagRes = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    expect(flagRes.ok).toBe(true);
  });

  it("TEACHER/PARENT rolü gün istisnası tanımlayamaz (RBAC)", async () => {
    const res1 = await setDayOverrideTool(ctx({ role: "TEACHER", teacherId: "t1" }), {
      date: "2026-08-08",
      isOpen: false,
      name: "x",
    });
    expect(res1.ok).toBe(false);
    const res2 = await setDayOverrideTool(ctx({ role: "PARENT", studentId: "s1" }), {
      date: "2026-08-08",
      isOpen: false,
      name: "x",
    });
    expect(res2.ok).toBe(false);
  });
});

describe("ÖNCELİK 4 — aylık plan (Tutar)", () => {
  it("aynı öğrenci+ay için tekrar set etmek yeni kayıt değil, güncelleme yapar (idempotent)", async () => {
    const r1 = await setMonthlyPlanAmountTool(ctx(), { studentId: "s1", month: "2026-09", amount: 3000 });
    expect(r1.ok).toBe(true);
    const r2 = await setMonthlyPlanAmountTool(ctx(), { studentId: "s1", month: "2026-09", amount: 3500 });
    expect(r2.ok).toBe(true);

    const data = await readData();
    const rows = data.payments.filter((p) => p.studentId === "s1" && p.source === "monthly_plan");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount).toBe(3500);
  });

  it("aylık plan kaydı asla 'paid'/tahsil edilmiş olarak işaretlenmez", async () => {
    await setMonthlyPlanAmountTool(ctx(), { studentId: "s1", month: "2026-09", amount: 3000 });
    const data = await readData();
    const row = data.payments.find((p) => p.studentId === "s1" && p.source === "monthly_plan");
    expect(row?.status).not.toBe("paid");
    expect(row?.paidAmount).toBe(0);
  });

  it("aylık plan ve lesson_ops kaynakları birbirinden ayrışır, mükerrer sayılmaz", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    await setMonthlyPlanAmountTool(ctx(), { studentId: "s1", month: "2026-09", amount: 3000 });

    const data = await readData();
    const lessonOpsRows = data.payments.filter((p) => p.studentId === "s1" && p.source === "lesson_ops");
    const planRows = data.payments.filter((p) => p.studentId === "s1" && p.source === "monthly_plan");
    expect(lessonOpsRows).toHaveLength(1);
    expect(planRows).toHaveLength(1);
    expect(lessonOpsRows[0]!.id).not.toBe(planRows[0]!.id);
  });

  it("TEACHER/PARENT rolü aylık plan tutarını değiştiremez (RBAC)", async () => {
    const res = await setMonthlyPlanAmountTool(ctx({ role: "TEACHER", teacherId: "t1" }), {
      studentId: "s1",
      month: "2026-09",
      amount: 3000,
    });
    expect(res.ok).toBe(false);
  });
});

describe("ÖNCELİK 4 — takvim görünürlüğü (RBAC)", () => {
  it("admin bir öğrencinin ay görünümünü okuyabilir", async () => {
    const res = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: 2026, month: 9 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.days.length).toBeGreaterThan(0);
    }
  });

  it("başka öğretmenin öğrencisi için takvim görüntülenemez (IDOR)", async () => {
    const res = await getAttendanceCalendarMonthTool(ctx({ role: "TEACHER", teacherId: "t2" }), {
      studentId: "s1", // s1 t1'e ait
      year: 2026,
      month: 9,
    });
    expect(res.ok).toBe(false);
  });

  it("2025 dışında bir akademik yıl da okunabilir (ör. 2019 ve 2032)", async () => {
    const past = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: 2019, month: 3 });
    const future = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: 2032, month: 3 });
    expect(past.ok).toBe(true);
    expect(future.ok).toBe(true);
  });
});

describe("ÖNCELİK 4 — veli (PARENT) salt-okunur takvim erişimi", () => {
  it("veli KENDİ öğrencisinin takvimini görüntüleyebilir", async () => {
    const res = await getAttendanceCalendarMonthTool(ctx({ role: "PARENT", studentId: "s1" }), {
      studentId: "s1",
      year: 2026,
      month: 9,
    });
    expect(res.ok).toBe(true);
  });

  it("yetkisiz veli BAŞKA bir öğrencinin takvimini göremez (backend'de kesin engel)", async () => {
    const res = await getAttendanceCalendarMonthTool(ctx({ role: "PARENT", studentId: "s2" }), {
      studentId: "s1",
      year: 2026,
      month: 9,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });

  it("veli gün istisnası (override) tanımlayamaz — ayrı bir salt-okunur endpoint dışında yazma yolu yok", async () => {
    const res = await setDayOverrideTool(ctx({ role: "PARENT", studentId: "s1" }), {
      date: "2026-09-10",
      isOpen: false,
      name: "x",
    });
    expect(res.ok).toBe(false);
  });

  it("veli aylık Tutar'ı değiştiremez", async () => {
    const res = await setMonthlyPlanAmountTool(ctx({ role: "PARENT", studentId: "s1" }), {
      studentId: "s1",
      month: "2026-09",
      amount: 5000,
    });
    expect(res.ok).toBe(false);
  });

  it("veli Geldi/İşlendi/Telafi işaretleyemez (yoklama oluşturamaz/değiştiremez)", async () => {
    const lessonId = await createTestLesson();
    const res = await setLessonOpsFlagTool(ctx({ role: "PARENT", studentId: "s1" }), {
      lessonId,
      flag: "attended",
    });
    expect(res.ok).toBe(false);
  });

  it("admin bir günü kapatınca, aynı öğrencinin velisi de takvimde bu değişikliği görür (aynı kaynak)", async () => {
    const before = await getAttendanceCalendarMonthTool(ctx({ role: "PARENT", studentId: "s1" }), {
      studentId: "s1",
      year: 2026,
      month: 9,
    });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const day = before.data.days.find((d) => d.status === "open")!;

    const overrideRes = await setDayOverrideTool(ctx(), { date: day.date, isOpen: false, name: "Özel kapalı" });
    expect(overrideRes.ok).toBe(true);

    const after = await getAttendanceCalendarMonthTool(ctx({ role: "PARENT", studentId: "s1" }), {
      studentId: "s1",
      year: 2026,
      month: 9,
    });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const sameDay = after.data.days.find((d) => d.date === day.date)!;
    expect(sameDay.status).toBe("closed");
    expect(sameDay.reason).toBe("manual_closed");
  });
});

describe("ÖNCELİK 4 (devam) — Yoklama takviminde tutar/ödeme bilgisi", () => {
  it("Geldi işaretlenen dersin günü, tutar + kayıt tarihi + ödeme şekli döner (tek kaynak, mevcut Payment)", async () => {
    const lessonId = await createTestLesson();
    const flagRes = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    expect(flagRes.ok).toBe(true);

    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const payment = data.payments.find((p) => p.lessonId === lessonId)!;
    const [y, m] = lesson.startAt.slice(0, 7).split("-").map(Number);

    const monthRes = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    expect(monthRes.ok).toBe(true);
    if (!monthRes.ok) return;
    const day = monthRes.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!;
    expect(day.payments).toHaveLength(1);
    expect(day.payments[0]!.lessonId).toBe(lessonId);
    expect(day.payments[0]!.amount).toBe(payment.amount);
    expect(day.payments[0]!.recordedAt).toBeTruthy();
    expect(day.payments[0]!.source).toBe("lesson_ops");
  });

  it("ders için hiç tahsilat yoksa (henüz Geldi/İşlendi işaretlenmemiş) payments boş döner — sahte kayıt yok", async () => {
    const lessonId = await createTestLesson();
    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const [y, m] = lesson.startAt.slice(0, 7).split("-").map(Number);

    const monthRes = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    expect(monthRes.ok).toBe(true);
    if (!monthRes.ok) return;
    const day = monthRes.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!;
    expect(day.payments).toHaveLength(0);
  });

  it("statü değişse bile (confirmSwitch) o günün tutar bilgisi mükerrerleşmez — hâlâ tek kayıt", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "processed", confirmSwitch: true });

    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const [y, m] = lesson.startAt.slice(0, 7).split("-").map(Number);
    const monthRes = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    expect(monthRes.ok).toBe(true);
    if (!monthRes.ok) return;
    const day = monthRes.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!;
    expect(day.payments).toHaveLength(1);
  });
});

describe("ÖNCELİK 4 (devam) — öğrenci dönemine göre varsayılan takvim", () => {
  it("admin öğrencinin termType'ını Yaz yapınca, takvim ay çözümlemesi 'yaz' döner (Güz varsayılanı değil)", async () => {
    const before = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: 2026, month: 9 });
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.data.term).toBe("guz"); // varsayılan öğrenci Güz

    const updateRes = await updateStudentProfileTool(ctx(), { studentId: "s1", termType: "yaz" });
    expect(updateRes.ok).toBe(true);

    const after = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: 2026, month: 7 });
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.data.term).toBe("yaz");
  });

  it("TEACHER/PARENT öğrencinin dönemini değiştiremez (RBAC)", async () => {
    const res = await updateStudentProfileTool(ctx({ role: "TEACHER", teacherId: "t1" }), {
      studentId: "s1",
      termType: "yaz",
    });
    expect(res.ok).toBe(false);
  });

  it("admin yeni öğrenci oluştururken termType atayabilir — form/kayıt akışıyla uyumlu", async () => {
    const res = await createStudentTool(ctx(), {
      name: "Test Öğrenci",
      email: "",
      phone: "5551234567",
      parentName: "Veli Adı",
      parentPhone: "5559876543",
      branchId: "erzene",
      instrument: "Piyano",
      teacherId: "t1",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3000,
      notes: "",
      termType: "yaz",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const data = await readData();
    const created = data.students.find((s) => s.id === res.data.studentId);
    expect(created?.termType).toBe("yaz");
  });

  it("PARENT/TEACHER yeni öğrenci oluşturamaz (dolayısıyla termType de atayamaz)", async () => {
    const res = await createStudentTool(ctx({ role: "TEACHER", teacherId: "t1" }), {
      name: "X",
      email: "",
      phone: "5551234567",
      parentName: "Y",
      parentPhone: "5559876543",
      branchId: "erzene",
      instrument: "Piyano",
      teacherId: "t1",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3000,
      notes: "",
      termType: "yaz",
    });
    expect(res.ok).toBe(false);
  });

  it("termType hiç verilmeden oluşturulan (legacy) öğrenci veri kaybı/hata olmadan Güz fallback'i ile takvimde çalışır", async () => {
    const res = await createStudentTool(ctx(), {
      name: "Legacy Öğrenci",
      email: "",
      phone: "5551234567",
      parentName: "Veli Adı",
      parentPhone: "5559876543",
      branchId: "erzene",
      instrument: "Piyano",
      teacherId: "t1",
      packageName: "Bireysel Aylık — 4 ders",
      weeklyLessonCount: 1,
      monthlyFee: 3000,
      notes: "",
      // termType verilmedi — legacy senaryo
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const data = await readData();
    const created = data.students.find((s) => s.id === res.data.studentId);
    expect(created?.termType).toBeUndefined();

    const calendarRes = await getAttendanceCalendarMonthTool(ctx(), {
      studentId: res.data.studentId,
      year: 2026,
      month: 9,
    });
    expect(calendarRes.ok).toBe(true);
    if (calendarRes.ok) expect(calendarRes.data.term).toBe("guz"); // fallback, hata yok
  });
});
