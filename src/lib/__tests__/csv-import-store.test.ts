import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { importBranches, importTeachers, importRooms, importStudents, readData } from "../store";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
});

describe("importBranches (store)", () => {
  it("geçerli satır yeni şube ekler", async () => {
    const result = await importBranches([
      { name: "Bostanlı Şubesi", shortName: "Bostanlı", city: "İzmir", phone: "0555", address: "Adres" },
    ]);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    const data = await readData();
    expect(data.settings.branches.some((b) => b.shortName === "Bostanlı")).toBe(true);
  });

  it("aynı dosya tekrar aktarılınca duplicate şube oluşturmaz — günceller", async () => {
    const row = { name: "Bostanlı Şubesi", shortName: "Bostanlı", city: "İzmir", phone: "0555", address: "Adres" };
    await importBranches([row]);
    const second = await importBranches([{ ...row, phone: "0556" }]);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const data = await readData();
    const matches = data.settings.branches.filter((b) => b.shortName === "Bostanlı");
    expect(matches).toHaveLength(1);
    expect(matches[0].phone).toBe("0556");
  });
});

describe("importTeachers (store)", () => {
  it("geçerli satır demo şubeye yeni öğretmen ekler", async () => {
    const result = await importTeachers([
      { name: "Yeni Öğretmen", email: "yeni@ogretmen.com", phone: "0555", branchId: "erzene", instrument: "Piyano" },
    ]);
    expect(result.created).toBe(1);
    const data = await readData();
    expect(data.teachers.some((t) => t.email === "yeni@ogretmen.com")).toBe(true);
  });

  it("aynı e-posta tekrar aktarılınca duplicate öğretmen oluşturmaz", async () => {
    const row = { name: "Yeni Öğretmen", email: "yeni@ogretmen.com", phone: "0555", branchId: "erzene", instrument: "Piyano" as const };
    await importTeachers([row]);
    const second = await importTeachers([{ ...row, phone: "0556" }]);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const data = await readData();
    expect(data.teachers.filter((t) => t.email === "yeni@ogretmen.com")).toHaveLength(1);
  });
});

describe("importRooms (store)", () => {
  it("geçerli satır yeni oda ekler; aynı (şube, ad) tekrarında günceller", async () => {
    const row = { name: "Yeni Stüdyo", branchId: "erzene", capacity: 2, instruments: ["Piyano"] as const };
    const first = await importRooms([row]);
    expect(first.created).toBe(1);

    const second = await importRooms([{ ...row, capacity: 3 }]);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const data = await readData();
    const matches = data.rooms.filter((r) => r.name === "Yeni Stüdyo" && r.branchId === "erzene");
    expect(matches).toHaveLength(1);
    expect(matches[0].capacity).toBe(3);
  });
});

describe("importStudents (store)", () => {
  it("geçerli satır yeni öğrenci ekler; aynı telefon tekrarında günceller", async () => {
    const data0 = await readData();
    const teacherId = data0.teachers[0].id;
    const row = {
      name: "Yeni Öğrenci",
      email: "",
      phone: "0555 999 0000",
      parentName: "Veli",
      parentPhone: "0555 999 0001",
      branchId: "erzene",
      instrument: "Piyano" as const,
      teacherId,
      packageName: "Paket",
      weeklyLessonCount: 1,
      monthlyFee: 3000,
      notes: "",
    };
    const first = await importStudents([row]);
    expect(first.created).toBe(1);

    const second = await importStudents([{ ...row, monthlyFee: 3500 }]);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const data = await readData();
    const matches = data.students.filter((s) => s.phone === "0555 999 0000");
    expect(matches).toHaveLength(1);
    expect(matches[0].monthlyFee).toBe(3500);
  });
});
