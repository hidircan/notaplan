import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { validateLessonSlot } from "../makeup-engine";
import { createLessonTool, setLessonOpsFlagTool, cancelLessonTool } from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";
import { applyLessonOpsFlag, computeLessonChargeAmount } from "../lesson-ops";

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

async function findOpenSlot(
  data: Awaited<ReturnType<typeof readData>>,
  studentId: string,
  teacherId: string,
  roomId: string
): Promise<string> {
  for (let offset = 1; offset <= 14; offset++) {
    for (let hour = 9; hour <= 16; hour++) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      d.setHours(hour, 0, 0, 0);
      const candidate = d.toISOString();
      const check = validateLessonSlot(
        data,
        { instrument: "Piyano", studentId },
        { teacherId, roomId, startAt: candidate }
      );
      if (check.ok) return candidate;
    }
  }
  throw new Error("no open slot found");
}

async function createTestLesson(): Promise<string> {
  const data = await readData();
  const startAt = await findOpenSlot(data, "s1", "t1", "r1");
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

describe("computeLessonChargeAmount — öğrenci ders başı ücret hesaplama", () => {
  it("aylık ücreti haftalık ders sayısına böler", () => {
    const amt = computeLessonChargeAmount({ monthlyFee: 4000, weeklyLessonCount: 1 });
    // 4000 / (1 * 52/12) ≈ 923
    expect(amt).toBeGreaterThan(900);
    expect(amt).toBeLessThan(950);
  });

  it("weeklyLessonCount=0 durumunda aylık ücrete düşer (0'a bölme yok)", () => {
    const amt = computeLessonChargeAmount({ monthlyFee: 3000, weeklyLessonCount: 0 });
    expect(amt).toBe(3000);
  });

  it("her zaman tam TL'ye yuvarlar", () => {
    const amt = computeLessonChargeAmount({ monthlyFee: 3333, weeklyLessonCount: 2 });
    expect(Number.isInteger(amt)).toBe(true);
  });
});

describe("Geldi/İşlendi — otomatik tahsilat (çift kayıt önleme)", () => {
  it("Geldi işaretlenince tam olarak bir tahsilat oluşur, lessonId ile ilişkilidir", async () => {
    const lessonId = await createTestLesson();
    const before = await readData();
    expect(before.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(0);

    const res = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    expect(res.ok).toBe(true);

    const after = await readData();
    const linked = after.payments.filter((p) => p.lessonId === lessonId);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.source).toBe("lesson_ops");
    expect(linked[0]!.studentId).toBe("s1");
    expect(linked[0]!.amount).toBeGreaterThan(0);
  });

  it("Geldi tekrar işaretlenirse (alreadySet) ikinci bir tahsilat oluşmaz", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    const second = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.data.alreadySet).toBe(true);

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(1);
  });

  it("Geldi'den sonra İşlendi işaretlenirse mükerrer tahsilat oluşmaz — hâlâ tek kayıt", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    const processed = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "processed" });
    expect(processed.ok).toBe(true);

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(1);
  });

  it("yalnız İşlendi (Geldi olmadan) de tam olarak bir tahsilat oluşturur", async () => {
    const lessonId = await createTestLesson();
    const res = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "processed" });
    expect(res.ok).toBe(true);

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(1);
  });

  it("iki farklı ders için ayrı ayrı tahsilat oluşur — birbirini etkilemez", async () => {
    const lessonId1 = await createTestLesson();
    const data = await readData();
    const startAt2 = await findOpenSlot(data, "s1", "t1", "r1");
    const created2 = await createLessonTool(ctx(), {
      studentId: "s1",
      teacherId: "t1",
      roomId: "r1",
      instrument: "Piyano",
      startAt: startAt2,
    });
    expect(created2.ok).toBe(true);
    if (!created2.ok) return;
    const lessonId2 = created2.data.lessonId;

    await setLessonOpsFlagTool(ctx(), { lessonId: lessonId1, flag: "attended" });
    await setLessonOpsFlagTool(ctx(), { lessonId: lessonId2, flag: "attended" });

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId1)).toHaveLength(1);
    expect(after.payments.filter((p) => p.lessonId === lessonId2)).toHaveLength(1);
  });
});

describe("Telafi — varsayılan olarak mali sonuç doğurmaz", () => {
  it("Telafi tek başına (varsayılan ayar) hiçbir tahsilat oluşturmaz", async () => {
    const lessonId = await createTestLesson();
    const res = await setLessonOpsFlagTool(ctx(), { lessonId, flag: "makeup" });
    expect(res.ok).toBe(true);

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(0);
  });

  it("telafiChargesOnFlag=true iken Telafi işareti de tahsilat oluşturur", async () => {
    const lessonId = await createTestLesson();
    const data = await readData();
    const withSetting = {
      ...data,
      settings: {
        ...data.settings,
        collectionsSettings: { ...(data.settings.collectionsSettings ?? { frequencyLimitDays: 3, autoSendEnabled: false }), telafiChargesOnFlag: true },
      },
    };
    const result = applyLessonOpsFlag(withSetting, lessonId, "makeup", "u1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(1);
  });

  it("gerçekleşen telafi dersinin KENDİSİ Geldi/İşlendi işaretlenince kendi tarihi üzerinden ücret oluşur", async () => {
    // Orijinal dersi Telafi olarak işaretle — mali sonuç yok, ama bir MakeupRequest oluşur.
    const sourceLessonId = await createTestLesson();
    const makeupRes = await setLessonOpsFlagTool(ctx(), { lessonId: sourceLessonId, flag: "makeup" });
    expect(makeupRes.ok).toBe(true);
    const afterMakeup = await readData();
    expect(afterMakeup.payments.filter((p) => p.lessonId === sourceLessonId)).toHaveLength(0);

    // Telafi dersi GERÇEKLEŞTİĞİNDE (yeni, ayrı bir lessonId) kendi Geldi/İşlendi'si
    // aynı mekanizmadan geçer ve KENDİ tarihi üzerinden ücret oluşturur.
    const realizedMakeupStartAt = await findOpenSlot(afterMakeup, "s1", "t1", "r1");
    const realizedLesson = await createLessonTool(ctx(), {
      studentId: "s1",
      teacherId: "t1",
      roomId: "r1",
      instrument: "Piyano",
      startAt: realizedMakeupStartAt,
    });
    expect(realizedLesson.ok).toBe(true);
    if (!realizedLesson.ok) return;
    const realizedProcessed = await setLessonOpsFlagTool(ctx(), {
      lessonId: realizedLesson.data.lessonId,
      flag: "processed",
    });
    expect(realizedProcessed.ok).toBe(true);

    const final = await readData();
    const charge = final.payments.find((p) => p.lessonId === realizedLesson.data.lessonId);
    expect(charge).toBeDefined();
    expect(charge?.source).toBe("lesson_ops");
  });
});

describe("Ders iptali — ödenmemiş otomatik tahsilatı iptal eder", () => {
  it("Geldi işaretlenmiş ama henüz ödenmemiş bir dersin iptali, tahsilatı 'voided' yapar", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    const beforeCancel = await readData();
    const payment = beforeCancel.payments.find((p) => p.lessonId === lessonId);
    expect(payment?.status).not.toBe("voided");

    const cancelRes = await cancelLessonTool(ctx(), { lessonId });
    expect(cancelRes.ok).toBe(true);

    const after = await readData();
    const voided = after.payments.find((p) => p.lessonId === lessonId);
    expect(voided?.status).toBe("voided");
  });

  it("iptal edilmiş (voided) bir tahsilat artık borç/bekleyen sayılmaz", async () => {
    const lessonId = await createTestLesson();
    await setLessonOpsFlagTool(ctx(), { lessonId, flag: "attended" });
    await cancelLessonTool(ctx(), { lessonId });

    const after = await readData();
    const voided = after.payments.find((p) => p.lessonId === lessonId);
    expect(voided?.status).toBe("voided");
    expect(voided?.paidAmount).toBe(0);
  });
});

describe("Mali entegrasyon — RBAC (mevcut setLessonOpsFlagTool kurallarını miras alır)", () => {
  it("PARENT/STUDENT yoklama işaretleyemez, dolayısıyla mali kayıt da tetiklenmez", async () => {
    const lessonId = await createTestLesson();
    const res = await setLessonOpsFlagTool(ctx({ role: "PARENT", studentId: "s1" }), {
      lessonId,
      flag: "attended",
    });
    expect(res.ok).toBe(false);

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(0);
  });

  it("başka bir öğretmen (IDOR) yoklama işaretleyemez, mali kayıt tetiklenmez", async () => {
    const lessonId = await createTestLesson(); // t1'e ait
    const res = await setLessonOpsFlagTool(ctx({ role: "TEACHER", teacherId: "t2", userId: "teacher2" }), {
      lessonId,
      flag: "attended",
    });
    expect(res.ok).toBe(false);

    const after = await readData();
    expect(after.payments.filter((p) => p.lessonId === lessonId)).toHaveLength(0);
  });
});
