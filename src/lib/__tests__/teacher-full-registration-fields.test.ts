import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { createTeacherTool } from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");
const CATALOG_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "instrument-catalog.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return { role: "SCHOOL_ADMIN", userId: "u1", tenantId: DEFAULT_TENANT_ID, channel: "web", ...overrides };
}

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  await fs.rm(CATALOG_FILE, { force: true });
});

describe("Öğretmen kaydında tüm özlük/eğitim/acil durum alanları (Paket 7)", () => {
  it("kayıt sırasında tüm ek alanlar girilip saklanabilir", async () => {
    const res = await createTeacherTool(ctx(), {
      name: "Tam Kayıt Öğretmeni",
      email: "tam@okul.com",
      phone: "5551234567",
      branchId: "erzene",
      instrument: "Piyano",
      highSchool: "Bornova Anadolu Lisesi",
      university: "İzmir DEÜ",
      graduationYear: 2015,
      birthDate: "1990-05-10",
      address: "Test Mah. No:5",
      contractStartDate: "2026-01-01",
      contractEndDate: "2027-01-01",
      employmentType: "tam_zamanli",
      hireDate: "2026-01-01",
      emergencyContactName: "Acil Kişi",
      emergencyContactPhone: "5559998877",
      weeklyHoursThreshold: 20,
      personnelNotes: "Test notu",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const data = await readData();
    const teacher = data.teachers.find((t) => t.id === res.data.teacherId)!;
    expect(teacher.highSchool).toBe("Bornova Anadolu Lisesi");
    expect(teacher.university).toBe("İzmir DEÜ");
    expect(teacher.graduationYear).toBe(2015);
    expect(teacher.employmentType).toBe("tam_zamanli");
    expect(teacher.emergencyContactName).toBe("Acil Kişi");
    expect(teacher.emergencyContactPhone).toBe("5559998877");
    expect(teacher.weeklyHoursThreshold).toBe(20);
    expect(teacher.personnelNotes).toBe("Test notu");
  });

  it("alanlar boş bırakılırsa opsiyonel kalır (legacy akış kırılmaz)", async () => {
    const res = await createTeacherTool(ctx(), {
      name: "Minimal Öğretmen",
      email: "minimal@okul.com",
      phone: "5551234568",
      branchId: "erzene",
      instrument: "Keman",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const data = await readData();
    const teacher = data.teachers.find((t) => t.id === res.data.teacherId)!;
    expect(teacher.highSchool).toBeUndefined();
    expect(teacher.personnelNotes).toBeUndefined();
  });
});
