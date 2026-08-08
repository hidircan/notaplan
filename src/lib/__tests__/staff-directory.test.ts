import { describe, it, expect } from "vitest";
import { listAssignableStaff, resolveStaffLabel } from "../staff-directory";
import { DEFAULT_TENANT_ID } from "../auth/config";

const teachers = [
  { id: "t1", name: "Nilüfer Acar", active: true },
  { id: "t2", name: "Can Yılmaz", active: true },
  { id: "t9", name: "Arşivlenmiş Öğretmen", active: false },
];

/** Faz 2 madde 6 — gerçek personel dizini (yeni bir kullanıcı yönetim sistemi DEĞİL, mevcut Teacher + bootstrap User kimliklerinden bir görüntüleme listesi). */
describe("İş Takip — personel dizini (listAssignableStaff)", () => {
  it("aktif öğretmenleri + admin kullanıcıları birleştirir", async () => {
    const staff = await listAssignableStaff(DEFAULT_TENANT_ID, teachers);
    const ids = staff.map((s) => s.id);
    expect(ids).toContain("t1");
    expect(ids).toContain("t2");
    // Bootstrap admin kimlikleri (bkz. src/lib/auth/users.ts) — DEFAULT_TENANT_ID için.
    expect(staff.some((s) => s.role === "SCHOOL_ADMIN")).toBe(true);
    expect(staff.some((s) => s.role === "SUPER_ADMIN")).toBe(true);
  });

  it("pasif/arşivlenmiş öğretmenler listede GÖRÜNMEZ", async () => {
    const staff = await listAssignableStaff(DEFAULT_TENANT_ID, teachers);
    expect(staff.some((s) => s.id === "t9")).toBe(false);
  });

  it("öğretmen etiketleri Teacher.name'dir, admin etiketleri email'dir", async () => {
    const staff = await listAssignableStaff(DEFAULT_TENANT_ID, teachers);
    const t1 = staff.find((s) => s.id === "t1")!;
    expect(t1.label).toBe("Nilüfer Acar");
    const admin = staff.find((s) => s.role === "SCHOOL_ADMIN")!;
    expect(admin.label).toContain("@");
  });
});

describe("İş Takip — resolveStaffLabel", () => {
  it("bilinen bir ID için okunabilir etiket döner", async () => {
    const staff = await listAssignableStaff(DEFAULT_TENANT_ID, teachers);
    expect(resolveStaffLabel(staff, "t1")).toBe("Nilüfer Acar");
  });

  it("bilinmeyen bir ID için ham ID'ye düşer (veri kaybı yok)", async () => {
    const staff = await listAssignableStaff(DEFAULT_TENANT_ID, teachers);
    expect(resolveStaffLabel(staff, "unknown-id-123")).toBe("unknown-id-123");
  });

  it("undefined ID için undefined döner", async () => {
    const staff = await listAssignableStaff(DEFAULT_TENANT_ID, teachers);
    expect(resolveStaffLabel(staff, undefined)).toBeUndefined();
  });
});
