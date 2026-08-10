import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * audit-hook.ts is fire-and-forget by contract: it must NEVER throw/reject.
 * The "never throws even when Prisma is unavailable" case is exercised
 * against the REAL src/lib/db.ts (no mock) since this test suite already
 * runs with a placeholder `DATABASE_URL=file:./dev.db` — getPrisma() throws
 * synchronously in that state, which is exactly the scenario the hook must
 * degrade gracefully from. The "successful write" case mocks ../db.
 */
describe("recordAiAuditLog — never throws (real STORE_MODE=json env, no live DB)", () => {
  it("DB kullanılamıyorsa reddetmez — {persisted:false} ile deterministik döner", async () => {
    const { recordAiAuditLog } = await import("../ai/audit-hook");
    const result = await recordAiAuditLog({
      tenantId: "tenant_nilufer_acar",
      capabilityId: "collectionsMessageDraft",
      callerRole: "SCHOOL_ADMIN",
      chosenProvider: "gemini",
      usedFallback: false,
      success: true,
      durationMs: 12,
    });
    expect(result.persisted).toBe(false);
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  it("recordApprovalDecision de DB yokken reddetmez — {ok:false, error} döner", async () => {
    const { recordApprovalDecision } = await import("../ai/audit-hook");
    const result = await recordApprovalDecision({
      invocationId: "does-not-exist",
      tenantId: "tenant_nilufer_acar",
      approvalStatus: "approved",
      approvedBy: "user_admin",
    });
    expect(result.ok).toBe(false);
  });

  it("listAiAuditLogs de DB yokken reddetmez — [] döner", async () => {
    const { listAiAuditLogs } = await import("../ai/audit-hook");
    const result = await listAiAuditLogs("tenant_nilufer_acar");
    expect(result).toEqual([]);
  });
});

describe("recordAiAuditLog / recordApprovalDecision — mocked Prisma (mutlu yol + tenant izolasyonu)", () => {
  const upsertMock = vi.fn();
  const updateManyMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    upsertMock.mockReset();
    updateManyMock.mockReset();
  });

  it("başarılı yazımda {persisted:true} ve verilen id'yi döner (upsert çağrılır)", async () => {
    upsertMock.mockResolvedValue({});
    vi.doMock("../db", () => ({
      prisma: { aiAuditLog: { upsert: upsertMock, updateMany: updateManyMock } },
    }));

    const { recordAiAuditLog } = await import("../ai/audit-hook");
    const result = await recordAiAuditLog({
      id: "fixed-id-1",
      tenantId: "tenant_a",
      capabilityId: "collectionsMessageDraft",
      callerRole: "SCHOOL_ADMIN",
      chosenProvider: "gemini",
      usedFallback: false,
      success: true,
      durationMs: 42,
      approvalStatus: "pending_approval",
    });

    expect(result).toEqual({ id: "fixed-id-1", persisted: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fixed-id-1" },
        create: expect.objectContaining({ id: "fixed-id-1", tenantId: "tenant_a" }),
      })
    );
  });

  it("recordApprovalDecision WHERE'de hem invocationId hem tenantId kullanır — başka kurumun satırına asla dokunmaz", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    vi.doMock("../db", () => ({
      prisma: { aiAuditLog: { upsert: upsertMock, updateMany: updateManyMock } },
    }));

    const { recordApprovalDecision } = await import("../ai/audit-hook");
    const result = await recordApprovalDecision({
      invocationId: "inv_forged",
      tenantId: "tenant_a",
      approvalStatus: "approved",
      approvedBy: "user_x",
    });

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv_forged", tenantId: "tenant_a" } })
    );
    // count:0 → başka tenant'a ait olabilir veya hiç yok — ikisinde de ok:false.
    expect(result.ok).toBe(false);
  });

  it("recordApprovalDecision count>0 olduğunda ok:true döner", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    vi.doMock("../db", () => ({
      prisma: { aiAuditLog: { upsert: upsertMock, updateMany: updateManyMock } },
    }));

    const { recordApprovalDecision } = await import("../ai/audit-hook");
    const result = await recordApprovalDecision({
      invocationId: "inv_real",
      tenantId: "tenant_a",
      approvalStatus: "rejected",
      approvedBy: "user_admin",
    });

    expect(result.ok).toBe(true);
  });

  it("listAiAuditLogs yalnızca verilen tenantId ile filtreler (WHERE tenantId)", async () => {
    const findManyMock = vi.fn().mockResolvedValue([
      {
        id: "aiaudit_1",
        tenantId: "tenant_a",
        capabilityId: "collectionsMessageDraft",
        callerRole: "SCHOOL_ADMIN",
        chosenProvider: "gemini",
        usedFallback: false,
        success: true,
        errorMessage: null,
        durationMs: 30,
        approvalStatus: "pending_approval",
        approvedAt: null,
        approvedBy: null,
        createdAt: new Date("2026-08-02T10:00:00Z"),
      },
    ]);
    vi.doMock("../db", () => ({
      prisma: { aiAuditLog: { upsert: upsertMock, updateMany: updateManyMock, findMany: findManyMock } },
    }));

    const { listAiAuditLogs } = await import("../ai/audit-hook");
    const result = await listAiAuditLogs("tenant_a", 50);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant_a" }, take: 50 })
    );
    expect(result).toHaveLength(1);
    expect(result[0].capabilityId).toBe("collectionsMessageDraft");
  });
});
