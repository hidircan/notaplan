import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { createTeacherTool } from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
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

describe("öğretmen oluşturma anında müsaitlik", () => {
  it("availability verilmezse geriye dönük uyumlu varsayılan müsaitlik uygulanır", async () => {
    const res = await createTeacherTool(ctx(), {
      name: "Varsayılan Müsaitlik Öğretmeni",
      email: "varsayilan@okul.com",
      phone: "5551110000",
      branchId: "erzene",
      instrument: "Piyano",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const data = await readData();
    const teacher = data.teachers.find((t) => t.id === res.data.teacherId);
    expect(teacher?.availability).toEqual([
      { dayOfWeek: 1, start: "10:00", end: "18:00" },
      { dayOfWeek: 2, start: "10:00", end: "18:00" },
      { dayOfWeek: 3, start: "10:00", end: "18:00" },
      { dayOfWeek: 4, start: "10:00", end: "18:00" },
      { dayOfWeek: 5, start: "10:00", end: "16:00" },
    ]);
  });

  it("availability verilirse oluşturma anında doğrudan kaydedilir", async () => {
    const res = await createTeacherTool(ctx(), {
      name: "Özel Müsaitlik Öğretmeni",
      email: "ozel@okul.com",
      phone: "5551110001",
      branchId: "erzene",
      instrument: "Gitar",
      availability: [
        { dayOfWeek: 2, start: "09:00", end: "12:00" },
        { dayOfWeek: 4, start: "13:00", end: "17:00" },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const data = await readData();
    const teacher = data.teachers.find((t) => t.id === res.data.teacherId);
    expect(teacher?.availability).toEqual([
      { dayOfWeek: 2, start: "09:00", end: "12:00" },
      { dayOfWeek: 4, start: "13:00", end: "17:00" },
    ]);
  });

  it("availability boş dizi verilirse hiç müsaitlik yok olarak kaydedilir", async () => {
    const res = await createTeacherTool(ctx(), {
      name: "Boş Müsaitlik Öğretmeni",
      email: "bos@okul.com",
      phone: "5551110002",
      branchId: "erzene",
      instrument: "Şan",
      availability: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const data = await readData();
    const teacher = data.teachers.find((t) => t.id === res.data.teacherId);
    expect(teacher?.availability).toEqual([]);
  });

  it("geçersiz saat aralığı (bitiş <= başlangıç) reddedilir", async () => {
    const res = await createTeacherTool(ctx(), {
      name: "Geçersiz Müsaitlik Öğretmeni",
      email: "gecersiz@okul.com",
      phone: "5551110003",
      branchId: "erzene",
      instrument: "Bateri",
      availability: [{ dayOfWeek: 3, start: "18:00", end: "10:00" }],
    });
    expect(res.ok).toBe(false);
  });
});
