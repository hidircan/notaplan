import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  createLessonTool,
  setLessonOpsFlagTool,
  createPaymentTool,
  getAttendanceCalendarMonthTool,
  cancelLessonTool,
} from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";
import { findOpenLessonSlot } from "./helpers/lesson-slot";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

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
});

async function createTestLesson(): Promise<string> {
  const data = await readData();
  const startAt = await findOpenLessonSlot(data, "s1", "t1", "r1");
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

/**
 * ÖNCELİK 4 (devam) — Yoklama Takvimi'nden tahsilat. Bu testler, takvimin
 * yeni döndürdüğü `paymentId` alanının Ödemeler ekranının kullandığı AYNI
 * `createPaymentTool` ile eşleştiğini, iki yönlü senkronu (takvimden alınan
 * ödeme "paid" statüsüyle takvimde de anında görünür) ve çift tahsilat/iptal
 * davranışını doğrular. Yeni bir ödeme yolu/tool'u YOK — yalnızca mevcut
 * `createPaymentTool` (markPaymentPaid) çağrılıyor, tıpkı
 * `/api/v1/payments/:paymentId/pay` route'unun yaptığı gibi.
 */
describe("Yoklama Takvimi'nden tahsilat — mevcut Payment altyapısıyla iki yönlü senkron", () => {
  it("takvimden dönen paymentId, aynı öğrenci/tenant/kaynak derse bağlı gerçek bir Payment'tır", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });

    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const [y, m] = lesson.startAt.slice(0, 7).split("-").map(Number);
    const monthRes = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    expect(monthRes.ok).toBe(true);
    if (!monthRes.ok) return;
    const day = monthRes.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!;
    expect(day.payments).toHaveLength(1);
    const calendarPayment = day.payments[0]!;
    expect(calendarPayment.lessonId).toBe(lessonId);
    expect(calendarPayment.status).not.toBe("paid");

    const realPayment = data.payments.find((p) => p.id === calendarPayment.paymentId);
    expect(realPayment).toBeDefined();
    expect(realPayment?.studentId).toBe("s1");
    expect(realPayment?.lessonId).toBe(lessonId);
  });

  it("takvimdeki paymentId üzerinden createPaymentTool (Ödemeler ekranıyla AYNI tool) çağrılınca takvim anında 'paid' gösterir", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });

    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const [y, m] = lesson.startAt.slice(0, 7).split("-").map(Number);
    const before = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    if (!before.ok) throw new Error("setup failed");
    const paymentId = before.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!.payments[0]!.paymentId;

    const payRes = await createPaymentTool(ctx(), { paymentId });
    expect(payRes.ok).toBe(true);

    const after = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const day = after.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!;
    expect(day.payments[0]!.status).toBe("paid");
    expect(day.payments[0]!.paidAmount).toBe(day.payments[0]!.amount);
  });

  it("aynı paymentId ile ikinci kez tahsil çağrısı çift tahsilata yol açmaz (idempotent — tutar iki katına çıkmaz)", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    const data = await readData();
    const payment = data.payments.find((p) => p.lessonId === lessonId)!;

    const first = await createPaymentTool(ctx(), { paymentId: payment.id });
    expect(first.ok).toBe(true);
    const second = await createPaymentTool(ctx(), { paymentId: payment.id });
    expect(second.ok).toBe(true);

    const after = await readData();
    const finalPayment = after.payments.find((p) => p.id === payment.id)!;
    expect(finalPayment.status).toBe("paid");
    expect(finalPayment.paidAmount).toBe(finalPayment.amount);
  });

  it("iptal edilen (voided) bir ders için mevcut otomatik void korunur — takvimde 'voided' görünür, yeniden tahsil edilemez görünmeli", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;

    const cancelRes = await cancelLessonTool(ctx(), { lessonId });
    expect(cancelRes.ok).toBe(true);

    const [y, m] = lesson.startAt.slice(0, 7).split("-").map(Number);
    const monthRes = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    expect(monthRes.ok).toBe(true);
    if (!monthRes.ok) return;
    const day = monthRes.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!;
    expect(day.payments[0]!.status).toBe("voided");
  });

  it("Telafi tek başına (varsayılan ayar) tahsilat oluşturmaz — takvimde payments boş kalır", async () => {
    const lessonId = await createTestLesson();
    const res = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "makeup" });
    expect(res.ok).toBe(true);

    const data = await readData();
    const lesson = data.lessons.find((l) => l.id === lessonId)!;
    const [y, m] = lesson.startAt.slice(0, 7).split("-").map(Number);
    const monthRes = await getAttendanceCalendarMonthTool(ctx(), { studentId: "s1", year: y!, month: m! });
    expect(monthRes.ok).toBe(true);
    if (!monthRes.ok) return;
    const day = monthRes.data.days.find((d) => d.date === lesson.startAt.slice(0, 10))!;
    expect(day.payments).toHaveLength(0);
  });

  it("TEACHER/PARENT rolü tahsilat işaretleyemez (RBAC — mevcut finans yetki modeli)", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    const data = await readData();
    const payment = data.payments.find((p) => p.lessonId === lessonId)!;

    const teacherRes = await createPaymentTool(ctx({ role: "TEACHER", teacherId: "t1" }), { paymentId: payment.id });
    expect(teacherRes.ok).toBe(false);
    if (!teacherRes.ok) expect(teacherRes.error.code).toBe("FORBIDDEN");

    const parentRes = await createPaymentTool(ctx({ role: "PARENT", studentId: "s1" }), { paymentId: payment.id });
    expect(parentRes.ok).toBe(false);
  });
});
