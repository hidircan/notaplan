import { describe, it, expect } from "vitest";
import { mergeAppData } from "../institution/merge";
import { createSeedData } from "../seed";
import type { AppData } from "../types";

function withTenant(data: AppData, tenantId: string, name: string): AppData {
  return { ...data, settings: { ...data.settings, tenantId, name } };
}

describe("mergeAppData", () => {
  it("boş liste verilirse hata fırlatır", () => {
    expect(() => mergeAppData([])).toThrow();
  });

  it("tek veri seti verilirse aynen (referans olarak) döner", () => {
    const data = createSeedData();
    expect(mergeAppData([data])).toBe(data);
  });

  it("iki kurumun öğrenci/öğretmen/ders listelerini birleştirir", () => {
    const a = withTenant(createSeedData(), "tenant_a", "A Akademi");
    const b = withTenant(createSeedData(), "tenant_b", "B Akademi");
    const merged = mergeAppData([a, b]);

    expect(merged.students.length).toBe(a.students.length + b.students.length);
    expect(merged.teachers.length).toBe(a.teachers.length + b.teachers.length);
    expect(merged.lessons.length).toBe(a.lessons.length + b.lessons.length);
    expect(merged.payments.length).toBe(a.payments.length + b.payments.length);
  });

  it("şubeleri (branch) tüm kurumların birleşimi olarak döner — mevcut şube filtresi bunun üzerinde çalışır", () => {
    const a = withTenant(createSeedData(), "tenant_a", "A Akademi");
    const b = withTenant(createSeedData(), "tenant_b", "B Akademi");
    const merged = mergeAppData([a, b]);
    expect(merged.settings.branches.length).toBe(
      a.settings.branches.length + b.settings.branches.length
    );
  });

  it("settings'in tekil alanları (ör. isim) ilk kurumdan gelir", () => {
    const a = withTenant(createSeedData(), "tenant_a", "A Akademi");
    const b = withTenant(createSeedData(), "tenant_b", "B Akademi");
    const merged = mergeAppData([a, b]);
    expect(merged.settings.name).toBe("A Akademi");
  });
});
