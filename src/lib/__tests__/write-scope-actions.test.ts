import { describe, it, expect, vi, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

/**
 * actions.ts'in her mutasyonu withAuthContext üzerinden resolveWriteScope
 * çağırır; bu da taze bir oturum + cookie okuması gerektirir. Bu testler
 * sayfayı/aksiyonu gerçek bir HTTP isteği olmadan doğrudan çağırdığından
 * oturumu ve kurum cookie'sini burada sahteler (bkz. csv-import-teacher-bug
 * testindeki aynı desen).
 */
const mockSession: { ctx: ServiceContext } = {
  ctx: { role: "SCHOOL_ADMIN", userId: "u1", tenantId: DEFAULT_TENANT_ID, channel: "web" },
};
const mockCookieValue: { value: string | undefined } = { value: undefined };
const mockTenants: { list: { tenantId: string; name: string }[] } = { list: [] };

vi.mock("@/lib/auth/session", () => ({
  requireSessionContext: async () => mockSession.ctx,
  getSessionContext: async () => mockSession.ctx,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "notaplan_kurum" && mockCookieValue.value !== undefined
        ? { value: mockCookieValue.value }
        : undefined,
    set: () => {},
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../store")>();
  return {
    ...actual,
    listTenants: async () => mockTenants.list,
  };
});

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

const actions = await import("../actions");
const { readData } = await import("../store");
const { ALL_MODE_WRITE_DENIED_MESSAGE } = await import("../institution/write-scope");

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  mockCookieValue.value = undefined;
  mockSession.ctx = { role: "SCHOOL_ADMIN", userId: "u1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
  mockTenants.list = [{ tenantId: DEFAULT_TENANT_ID, name: "Nilüfer Açar Müzik Akademisi" }];
});

function studentFormData(): FormData {
  const fd = new FormData();
  fd.set("name", "Test Öğrenci");
  fd.set("email", "test-student@example.com");
  fd.set("phone", "05550000000");
  fd.set("parentName", "Test Veli");
  fd.set("parentPhone", "05550000001");
  fd.set("branchId", "erzene");
  fd.set("instrument", "Piyano");
  fd.set("teacherId", "t1");
  return fd;
}

describe("Yazma kapsamı koruması — Öğrenciler (actionAddStudent)", () => {
  it("SUPER_ADMIN 'Tüm kurumlar' modunda (varsayılan) tam Türkçe mesajla reddedilir", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "Nilüfer Açar Müzik Akademisi" },
      { tenantId: "tenant_other", name: "Diğer Kurum" },
    ];
    const before = await readData();
    await expect(actions.actionAddStudent(studentFormData())).rejects.toThrow(
      ALL_MODE_WRITE_DENIED_MESSAGE
    );
    const after = await readData();
    expect(after.students.length).toBe(before.students.length);
  });

  it("SUPER_ADMIN tek bir geçerli kurum seçtiğinde mutasyon başarılı olur", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [{ tenantId: DEFAULT_TENANT_ID, name: "Nilüfer Açar Müzik Akademisi" }];
    mockCookieValue.value = DEFAULT_TENANT_ID;
    const before = await readData();
    await actions.actionAddStudent(studentFormData());
    const after = await readData();
    expect(after.students.length).toBe(before.students.length + 1);
    expect(after.students.some((s) => s.name === "Test Öğrenci")).toBe(true);
  });

  it("SCHOOL_ADMIN sahte/başka bir kurum cookie'siyle bile yalnızca kendi kurumuna yazar", async () => {
    mockSession.ctx = { role: "SCHOOL_ADMIN", userId: "admin1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [{ tenantId: DEFAULT_TENANT_ID, name: "Nilüfer Açar Müzik Akademisi" }];
    mockCookieValue.value = "tenant_forged_other_school";
    const before = await readData();
    await actions.actionAddStudent(studentFormData());
    const after = await readData();
    // Sahte cookie yok sayılır, varsayılan (kendi) kuruma yazılır — hiç
    // başka bir kuruma sızma olmadığı, aynı (tek) veri dosyasında öğrencinin
    // gerçekten oluşmasıyla kanıtlanır.
    expect(after.students.length).toBe(before.students.length + 1);
  });

  it("SCHOOL_ADMIN 'ALL' cookie'si göndermeyi dener ama kendi kurumunda kalır ve mutasyon başarılı olur", async () => {
    mockSession.ctx = { role: "SCHOOL_ADMIN", userId: "admin1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockCookieValue.value = "ALL";
    const before = await readData();
    await actions.actionAddStudent(studentFormData());
    const after = await readData();
    expect(after.students.length).toBe(before.students.length + 1);
  });
});

describe("Yazma kapsamı koruması — Yoklama (actionMarkAttendance)", () => {
  it("SUPER_ADMIN 'Tüm kurumlar' modunda reddedilir, yoklama kaydedilmez", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const before = await readData();
    const fd = new FormData();
    fd.set("lessonId", before.lessons[0].id);
    fd.set("status", "present");
    await expect(actions.actionMarkAttendance(fd)).rejects.toThrow(ALL_MODE_WRITE_DENIED_MESSAGE);
    const after = await readData();
    expect(after.attendances.length).toBe(before.attendances.length);
  });
});

describe("Yazma kapsamı koruması — Öğretmenler (actionAddTeacher)", () => {
  it("SUPER_ADMIN 'Tüm kurumlar' modunda reddedilir", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const fd = new FormData();
    fd.set("name", "Test Öğretmen");
    fd.set("email", "test-teacher@example.com");
    fd.set("phone", "05551111111");
    fd.set("branchId", "erzene");
    fd.set("instrument", "Piyano");
    await expect(actions.actionAddTeacher(fd)).rejects.toThrow(ALL_MODE_WRITE_DENIED_MESSAGE);
  });
});

describe("Yazma kapsamı koruması — Ödemeler (actionAddPayment / actionMarkPaymentPaid)", () => {
  it("actionAddPayment SUPER_ADMIN 'Tüm kurumlar' modunda reddedilir", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const fd = new FormData();
    fd.set("studentId", "s1");
    fd.set("description", "Test ödeme");
    fd.set("amount", "1000");
    fd.set("dueDate", "2026-12-01");
    await expect(actions.actionAddPayment(fd)).rejects.toThrow(ALL_MODE_WRITE_DENIED_MESSAGE);
  });

  it("actionMarkPaymentPaid SUPER_ADMIN 'Tüm kurumlar' modunda reddedilir, ödeme durumu değişmez", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const before = await readData();
    const unpaid = before.payments.find((p) => p.status !== "paid")!;
    const fd = new FormData();
    fd.set("paymentId", unpaid.id);
    await expect(actions.actionMarkPaymentPaid(fd)).rejects.toThrow(ALL_MODE_WRITE_DENIED_MESSAGE);
    const after = await readData();
    expect(after.payments.find((p) => p.id === unpaid.id)?.status).toBe(unpaid.status);
  });
});

describe("Yazma kapsamı koruması — Telafi (actionCancelMakeup / actionGenerateSuggestions / actionConfirmSlot)", () => {
  it("actionCancelMakeup SUPER_ADMIN 'Tüm kurumlar' modunda reddedilir", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const before = await readData();
    const req = before.makeupRequests[0];
    const fd = new FormData();
    fd.set("requestId", req.id);
    await expect(actions.actionCancelMakeup(fd)).rejects.toThrow(ALL_MODE_WRITE_DENIED_MESSAGE);
    const after = await readData();
    expect(after.makeupRequests.find((m) => m.id === req.id)?.status).toBe(req.status);
  });

  it("actionGenerateSuggestions SUPER_ADMIN 'Tüm kurumlar' modunda reddedilir", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const before = await readData();
    const req = before.makeupRequests[0];
    const fd = new FormData();
    fd.set("requestId", req.id);
    await expect(actions.actionGenerateSuggestions(fd)).rejects.toThrow(ALL_MODE_WRITE_DENIED_MESSAGE);
  });
});

describe("Yazma kapsamı koruması — Öğretmenler + Hakediş (fee rule / payout)", () => {
  it("actionCreateFeeRule SUPER_ADMIN 'Tüm kurumlar' modunda tam mesajla reddedilir (nesne döner, fırlatmaz)", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const result = await actions.actionCreateFeeRule({
      teacherId: "t1",
      perMinuteRate: 10,
      effectiveFrom: "2026-01-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(ALL_MODE_WRITE_DENIED_MESSAGE);
  });

  it("actionComputeTeacherPayout SUPER_ADMIN 'Tüm kurumlar' modunda tam mesajla reddedilir", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const result = await actions.actionComputeTeacherPayout({
      teacherId: "t1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(ALL_MODE_WRITE_DENIED_MESSAGE);
  });

  it("actionUpdateFeeRule tek bir geçerli kurum seçiliyken başarılı olur (kayıtlı seed kuralı güncellenir)", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [{ tenantId: DEFAULT_TENANT_ID, name: "A" }];
    mockCookieValue.value = DEFAULT_TENANT_ID;
    const before = await readData();
    const existingRule = before.teacherFeeRules.find((r) => r.teacherId === "t1")!;
    const result = await actions.actionUpdateFeeRule({
      ruleId: existingRule.id,
      perMinuteRate: 15,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rule.perMinuteRate).toBe(15);
  });
});

describe("Program (canCreate) referans davranışı değişmedi", () => {
  it("actionAddLesson SUPER_ADMIN 'Tüm kurumlar' modunda tam mesajla reddedilir (nesne döner)", async () => {
    mockSession.ctx = { role: "SUPER_ADMIN", userId: "super1", tenantId: DEFAULT_TENANT_ID, channel: "web" };
    mockTenants.list = [
      { tenantId: DEFAULT_TENANT_ID, name: "A" },
      { tenantId: "tenant_other", name: "B" },
    ];
    const fd = new FormData();
    fd.set("studentId", "s1");
    fd.set("teacherId", "t1");
    fd.set("roomId", "r1");
    fd.set("instrument", "Piyano");
    fd.set("startAt", "2026-09-01T10:00");
    const result = await actions.actionAddLesson(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(ALL_MODE_WRITE_DENIED_MESSAGE);
  });
});
