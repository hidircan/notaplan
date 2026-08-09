import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

/**
 * Öğrenciler ekranı "Sütunlar / Görünüm yönetimi" — paylaşılan görünümler
 * `AuditLog`/`AiAuditLog` ile AYNI kabul edilen sınırda: yalnızca
 * `STORE_MODE=db`'de kalıcıdır. Burada `audit-log.test.ts`'in izlediği
 * yöntemle (mocked prisma) hem mutlu yol hem DB'siz (json/memory) davranış
 * doğrulanır — gerçek bir veritabanı GEREKMEZ.
 */
function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return { role: "SCHOOL_ADMIN", userId: "u1", tenantId: DEFAULT_TENANT_ID, channel: "web", ...overrides };
}

vi.mock("../audit/log", () => ({ recordAuditLog: vi.fn().mockResolvedValue(undefined) }));

describe("listStudentListViewsTool", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("yetkisiz rol (TEACHER) görünümleri listeleyemez", async () => {
    vi.doMock("../db", () => ({ prisma: { studentListView: { findMany: vi.fn() } } }));
    const { listStudentListViewsTool } = await import("../services/tools");
    const res = await listStudentListViewsTool(ctx({ role: "TEACHER" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });

  it("DB kullanılamıyorsa (json/memory) fırlatmaz — boş liste döner", async () => {
    vi.doMock("../db", () => ({
      prisma: { studentListView: { findMany: vi.fn().mockRejectedValue(new Error("no db")) } },
    }));
    const { listStudentListViewsTool } = await import("../services/tools");
    const res = await listStudentListViewsTool(ctx());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it("mutlu yolda tenant-scoped okur ve kolon listesini döner", async () => {
    const findManyMock = vi.fn().mockResolvedValue([
      { id: "v1", name: "Kısa liste", columns: ["branch", "teacher"], createdByUserId: "u1" },
    ]);
    vi.doMock("../db", () => ({ prisma: { studentListView: { findMany: findManyMock } } }));
    const { listStudentListViewsTool } = await import("../services/tools");
    const res = await listStudentListViewsTool(ctx());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([{ id: "v1", name: "Kısa liste", columns: ["branch", "teacher"], createdByUserId: "u1" }]);
    }
    expect(findManyMock.mock.calls[0][0].where).toMatchObject({ tenantId: DEFAULT_TENANT_ID });
  });
});

describe("saveStudentListViewTool", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("aynı isimle tekrar kaydetmek upsert eder (aynı tenant+name benzersizliği)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ id: "v1", name: "Kısa liste" });
    vi.doMock("../db", () => ({
      prisma: {
        studentListView: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: upsertMock,
        },
      },
    }));
    const { saveStudentListViewTool } = await import("../services/tools");
    const res = await saveStudentListViewTool(ctx(), { name: "Kısa liste", columns: ["branch", "teacher"] });
    expect(res.ok).toBe(true);
    expect(upsertMock.mock.calls[0][0].where).toEqual({
      tenantId_name: { tenantId: DEFAULT_TENANT_ID, name: "Kısa liste" },
    });
  });

  it("geçersiz girdi (boş kolon listesi) VALIDATION hatası döner", async () => {
    vi.doMock("../db", () => ({ prisma: { studentListView: { findUnique: vi.fn(), upsert: vi.fn() } } }));
    const { saveStudentListViewTool } = await import("../services/tools");
    const res = await saveStudentListViewTool(ctx(), { name: "Boş", columns: [] });
    expect(res.ok).toBe(false);
  });
});
