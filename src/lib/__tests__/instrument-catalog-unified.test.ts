import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  listInstrumentCatalogTool,
  updateInstrumentCatalogTool,
  createTeacherTool,
} from "../services/tools";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const CATALOG_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "instrument-catalog.json");
const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return { role: "SCHOOL_ADMIN", userId: "u1", tenantId: DEFAULT_TENANT_ID, channel: "web", ...overrides };
}

beforeEach(async () => {
  await fs.rm(CATALOG_FILE, { force: true });
  await fs.rm(DATA_FILE, { force: true });
});

/**
 * "Enstrümanlar ekranındaki sabit enstrüman ayrımına gerek yok, tüm
 * enstrümanlar değiştirilebilir olsun" — bu dosya eski "Piyano vb. asla
 * pasife alınamaz sabit liste" davranışının kaldırıldığını doğrular.
 */
describe("Enstrümanlar — sabit/dinamik ayrımı kaldırıldı", () => {
  it("eski sabit enstrümanlar (Piyano dahil) katalogda düzenlenebilir satırlar olarak görünür", async () => {
    const res = await listInstrumentCatalogTool(ctx(), {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const names = res.data.entries.map((e) => e.name);
    expect(names).toContain("Piyano");
    expect(names).toContain("Keman");
    expect(names).toContain("Bas Gitar");
  });

  it("Piyano yeniden adlandırılabilir", async () => {
    const list = await listInstrumentCatalogTool(ctx(), {});
    if (!list.ok) throw new Error("setup failed");
    const piyano = list.data.entries.find((e) => e.name === "Piyano")!;
    const res = await updateInstrumentCatalogTool(ctx(), { entryId: piyano.id, name: "Klasik Piyano" });
    expect(res.ok).toBe(true);

    const after = await listInstrumentCatalogTool(ctx(), {});
    if (!after.ok) throw new Error("relist failed");
    expect(after.data.entries.map((e) => e.name)).toContain("Klasik Piyano");
    expect(after.data.entries.map((e) => e.name)).not.toContain("Piyano");
  });

  it("Piyano pasife alınabilir ve pasife alındıktan sonra yeni öğretmen kaydında artık geçerli sayılmaz", async () => {
    const list = await listInstrumentCatalogTool(ctx(), {});
    if (!list.ok) throw new Error("setup failed");
    const piyano = list.data.entries.find((e) => e.name === "Piyano")!;
    const archiveRes = await updateInstrumentCatalogTool(ctx(), { entryId: piyano.id, status: "archived" });
    expect(archiveRes.ok).toBe(true);

    const teacherRes = await createTeacherTool(ctx(), {
      name: "Test Öğretmen",
      email: "test@test.com",
      phone: "5551234567",
      branchId: "erzene",
      instrument: "Keman",
      instrumentLevels: [{ instrument: "Piyano", level: "Başlangıç" }],
    });
    expect(teacherRes.ok).toBe(false);
  });
});
