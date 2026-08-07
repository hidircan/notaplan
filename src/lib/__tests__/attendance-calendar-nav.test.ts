import { describe, it, expect } from "vitest";
import { termMonthList, currentAnchorYear } from "../../components/attendance-calendar-panel";

describe("ÖNCELİK 4 — takvim yıl/dönem gezinme (saf yardımcılar)", () => {
  it("2025 dışında bir akademik yıla geçilebilir (ör. 2030 Güz)", () => {
    const months = termMonthList("guz", 2030);
    expect(months[0]).toEqual({ year: 2030, month: 9 });
    expect(months.at(-1)).toEqual({ year: 2031, month: 6 });
  });

  it("geçmiş bir akademik yıla da geçilebilir (ör. 2019 Yaz)", () => {
    const months = termMonthList("yaz", 2019);
    expect(months).toHaveLength(3);
    expect(months[0]!.year).toBe(2019);
  });

  it("önceki/sonraki yıl geçişi Güz için art arda ardışık çapa yılları üretir", () => {
    const anchor = 2026;
    const prev = anchor - 1;
    const next = anchor + 1;
    expect(termMonthList("guz", prev)[0]).toEqual({ year: 2025, month: 9 });
    expect(termMonthList("guz", next)[0]).toEqual({ year: 2027, month: 9 });
  });

  it("currentAnchorYear Güz'de Eylül-Aralık aralığında içinde bulunulan takvim yılını, Ocak-Ağustos'ta bir önceki yılı döner", () => {
    // Bilinen referans: 2026-08-07 Cuma (Ağustos → hâlâ 2025 Güz dönemi çapası)
    // Doğrudan tarihe bağlı olmayan, formülün kendisini test ediyoruz.
    const now = new Date();
    const expected = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    expect(currentAnchorYear("guz")).toBe(expected);
  });

  it("currentAnchorYear Yaz'da her zaman içinde bulunulan takvim yılını döner", () => {
    expect(currentAnchorYear("yaz")).toBe(new Date().getFullYear());
  });
});
