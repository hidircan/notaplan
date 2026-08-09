import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * EPIC 0 (IMPLEMENTATION_PLAN.md) — general critical-action audit trail.
 * Mocks `prisma` the same way `provider-bridge.test.ts` does for
 * `AiAuditLog`: no real DB required, and this also proves the "never
 * throws" fire-and-forget contract that `src/lib/services/tools.ts`'s
 * critical-write audit calls rely on.
 */

describe("recordAuditLog — asla fırlatmaz, tenant/actor/aksiyon doğru yazılır", () => {
  const createMock = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.resetModules();
    createMock.mockClear();
    vi.doMock("../db", () => ({
      prisma: { auditLog: { create: createMock, findMany: vi.fn().mockResolvedValue([]) } },
    }));
  });

  it("başarılı yazımda persisted:true döner ve doğru alanlarla prisma.auditLog.create çağrılır", async () => {
    const { recordAuditLog } = await import("../audit/log");
    const result = await recordAuditLog({
      tenantId: "tenant_a",
      actorUserId: "u1",
      actorRole: "SCHOOL_ADMIN",
      action: "payment.mark_paid",
      entityType: "Payment",
      entityId: "p1",
      outcome: "success",
      meta: { amount: 100 },
    });
    expect(result.persisted).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0][0];
    expect(call.data).toMatchObject({
      tenantId: "tenant_a",
      actorUserId: "u1",
      actorRole: "SCHOOL_ADMIN",
      action: "payment.mark_paid",
      entityType: "Payment",
      entityId: "p1",
      outcome: "success",
      meta: { amount: 100 },
    });
  });

  it("DB yazımı başarısız olsa bile fırlatmaz — persisted:false döner", async () => {
    createMock.mockRejectedValueOnce(new Error("connection refused"));
    const { recordAuditLog } = await import("../audit/log");
    const result = await recordAuditLog({
      tenantId: "tenant_a",
      actorUserId: "u1",
      actorRole: "SCHOOL_ADMIN",
      action: "student.create",
      entityType: "Student",
      entityId: "s1",
      outcome: "success",
    });
    expect(result.persisted).toBe(false);
  });

  it("meta verilmezse undefined olarak geçirilir (uydurma alan eklenmez)", async () => {
    const { recordAuditLog } = await import("../audit/log");
    await recordAuditLog({
      tenantId: "tenant_a",
      actorUserId: "u1",
      actorRole: "TEACHER",
      action: "makeup.cancel",
      entityType: "MakeupRequest",
      entityId: "m1",
      outcome: "success",
    });
    expect(createMock.mock.calls[0][0].data.meta).toBeUndefined();
  });
});

describe("listAuditLogs — tenant-scoped okuma, asla fırlatmaz", () => {
  it("yalnızca istenen tenantId ile prisma.auditLog.findMany çağırır", async () => {
    const findManyMock = vi.fn().mockResolvedValue([]);
    vi.resetModules();
    vi.doMock("../db", () => ({
      prisma: { auditLog: { create: vi.fn(), findMany: findManyMock } },
    }));
    const { listAuditLogs } = await import("../audit/log");
    await listAuditLogs("tenant_b", { limit: 10 });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant_b" }) })
    );
  });

  it("DB okuması başarısız olursa boş dizi döner (STORE_MODE=json/memory ile aynı davranış)", async () => {
    vi.resetModules();
    vi.doMock("../db", () => ({
      prisma: {
        auditLog: {
          create: vi.fn(),
          findMany: vi.fn().mockRejectedValue(new Error("no db")),
        },
      },
    }));
    const { listAuditLogs } = await import("../audit/log");
    const rows = await listAuditLogs("tenant_a");
    expect(rows).toEqual([]);
  });

  it("Denetim Kaydı ekranı filtreleri (from/to/actorRole/action/entityType/outcome/search) findMany where'e doğru şekilde geçirilir", async () => {
    const findManyMock = vi.fn().mockResolvedValue([]);
    vi.resetModules();
    vi.doMock("../db", () => ({
      prisma: { auditLog: { create: vi.fn(), findMany: findManyMock } },
    }));
    const { listAuditLogs } = await import("../audit/log");
    await listAuditLogs("tenant_a", {
      from: "2026-08-01",
      to: "2026-08-09",
      actorRole: "SCHOOL_ADMIN",
      action: "payment.mark_paid",
      entityType: "Payment",
      outcome: "success",
      search: "p1",
      limit: 50,
    });
    const call = findManyMock.mock.calls[0][0];
    expect(call.where).toMatchObject({
      tenantId: "tenant_a",
      actorRole: "SCHOOL_ADMIN",
      action: "payment.mark_paid",
      entityType: "Payment",
      outcome: "success",
    });
    expect(call.where.createdAt.gte).toEqual(new Date("2026-08-01"));
    expect(call.where.createdAt.lte).toEqual(new Date("2026-08-09T23:59:59.999"));
    expect(call.where.OR).toEqual(
      expect.arrayContaining([{ action: { contains: "p1" } }, { entityId: { contains: "p1" } }])
    );
    expect(call.take).toBe(50);
  });

  it("filtre verilmezse where yalnızca tenantId içerir (tüm alanlar undefined)", async () => {
    const findManyMock = vi.fn().mockResolvedValue([]);
    vi.resetModules();
    vi.doMock("../db", () => ({
      prisma: { auditLog: { create: vi.fn(), findMany: findManyMock } },
    }));
    const { listAuditLogs } = await import("../audit/log");
    await listAuditLogs("tenant_c");
    const call = findManyMock.mock.calls[0][0];
    expect(call.where.action).toBeUndefined();
    expect(call.where.outcome).toBeUndefined();
    expect(call.where.OR).toBeUndefined();
  });
});

describe("auth/audit.ts auditLog() — artık gerçekten yazar (imza korunuyor)", () => {
  it("tenantId'li bir event AuditLog'a persist edilir", async () => {
    const createMock = vi.fn().mockResolvedValue({});
    vi.resetModules();
    vi.doMock("../db", () => ({
      prisma: { auditLog: { create: createMock, findMany: vi.fn() } },
    }));
    const { auditLog } = await import("../auth/audit");
    auditLog({
      action: "auth.login_success",
      requestId: "req1",
      userId: "u1",
      tenantId: "tenant_a",
      role: "SCHOOL_ADMIN",
      outcome: "success",
    });
    // fire-and-forget — mikro görev kuyruğunun boşalmasını bekle
    await new Promise((r) => setTimeout(r, 0));
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].data).toMatchObject({
      tenantId: "tenant_a",
      actorUserId: "u1",
      action: "auth.login_success",
      entityType: "Auth",
      outcome: "success",
    });
  });

  it("tenantId'siz bir event (ör. bilinmeyen e-posta ile başarısız giriş) HİÇ persist edilmez — fail-closed", async () => {
    const createMock = vi.fn().mockResolvedValue({});
    vi.resetModules();
    vi.doMock("../db", () => ({
      prisma: { auditLog: { create: createMock, findMany: vi.fn() } },
    }));
    const { auditLog } = await import("../auth/audit");
    auditLog({
      action: "auth.login_failed",
      requestId: "req2",
      outcome: "denied",
      meta: { email: "unknown@example.com" },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(createMock).not.toHaveBeenCalled();
  });
});
