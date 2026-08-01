import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  previewTeacherImportTool,
  commitTeacherImportTool,
  previewStudentImportTool,
  commitStudentImportTool,
} from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import { resolveBranchId, resolveTeacherIdByEmail } from "../import/branch-lookup";
import type { ServiceContext } from "../services/context";

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

const TEACHER_CSV_VALID = "ad,eposta,telefon,sube,enstruman\nSelin Kara,selin@okul.com,0555 111 1111,Erzene,Piyano\n";

describe("commitTeacherImportTool · hatalı dosya hiçbir şey yazmaz", () => {
  it("bir satırı bile hatalı olan CSV hiçbir kayıt yazmadan reddedilir", async () => {
    const before = await readData();
    const csv =
      "ad,eposta,telefon,sube,enstruman\n" +
      "Selin Kara,selin@okul.com,0555 111 1111,Erzene,Piyano\n" +
      "Ali Veli,gecersiz-eposta,0555 222 2222,Erzene,Piyano\n";

    const res = await commitTeacherImportTool(ctx(), { csvText: csv });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");

    const after = await readData();
    expect(after.teachers.length).toBe(before.teachers.length);
    expect(after.teachers.some((t) => t.email === "selin@okul.com")).toBe(false);
  });

  it("geçerli CSV doğru kayıtları ekler (preview + commit uçtan uca)", async () => {
    const preview = await previewTeacherImportTool(ctx(), { csvText: TEACHER_CSV_VALID });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.errorCount).toBe(0);
    expect(preview.data.validCount).toBe(1);

    const commit = await commitTeacherImportTool(ctx(), { csvText: TEACHER_CSV_VALID });
    expect(commit.ok).toBe(true);
    if (!commit.ok) return;
    expect(commit.data.created).toBe(1);

    const data = await readData();
    expect(data.teachers.some((t) => t.email === "selin@okul.com")).toBe(true);
  });

  it("aynı CSV iki kez aktarılınca duplicate öğretmen oluşturmaz", async () => {
    const first = await commitTeacherImportTool(ctx(), { csvText: TEACHER_CSV_VALID });
    expect(first.ok).toBe(true);
    const second = await commitTeacherImportTool(ctx(), { csvText: TEACHER_CSV_VALID });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.created).toBe(0);
    expect(second.data.updated).toBe(1);

    const data = await readData();
    expect(data.teachers.filter((t) => t.email === "selin@okul.com")).toHaveLength(1);
  });

  it("veli/öğretmen rolü içe aktarım yapamaz (FORBIDDEN)", async () => {
    const res = await commitTeacherImportTool(ctx({ role: "TEACHER" }), { csvText: TEACHER_CSV_VALID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});

describe("commitStudentImportTool · öğretmen içe aktarıldıktan sonra öğrenci akışı", () => {
  it("güvenli sıra: önce öğretmen, sonra o öğretmene referans veren öğrenci başarıyla eklenir", async () => {
    const teacherCommit = await commitTeacherImportTool(ctx(), { csvText: TEACHER_CSV_VALID });
    expect(teacherCommit.ok).toBe(true);

    const studentCsv =
      "ad,eposta,telefon,veli_adi,veli_telefon,sube,enstruman,ogretmen_eposta,paket_adi,haftalik_ders_sayisi,aylik_ucret,notlar\n" +
      "Deniz Ak,,0555 333 3333,Ayşe Ak,0555 333 3334,Erzene,Piyano,selin@okul.com,Paket,1,3000,\n";

    const preview = await previewStudentImportTool(ctx(), { csvText: studentCsv });
    expect(preview.ok).toBe(true);
    if (preview.ok) expect(preview.data.errorCount).toBe(0);

    const commit = await commitStudentImportTool(ctx(), { csvText: studentCsv });
    expect(commit.ok).toBe(true);
    if (!commit.ok) return;
    expect(commit.data.created).toBe(1);

    const data = await readData();
    const created = data.students.find((s) => s.phone === "0555 333 3333");
    expect(created).toBeDefined();
    const teacher = data.teachers.find((t) => t.email === "selin@okul.com");
    expect(created?.teacherId).toBe(teacher?.id);
  });
});

describe("tenant dışı / bulunamayan ilişki reddi", () => {
  it("mevcut tenant verisinde olmayan bir şube kısa adı asla çözülmez", async () => {
    const data = await readData();
    const result = resolveBranchId(data, "Başka Bir Okulun Şubesi");
    expect(result.ok).toBe(false);
  });

  it("mevcut tenant verisinde olmayan bir öğretmen e-postası asla çözülmez", async () => {
    const data = await readData();
    const result = resolveTeacherIdByEmail(data, "disaridan@baskaokul.com");
    expect(result.ok).toBe(false);
  });
});
