import { describe, it, expect, vi, afterEach } from "vitest";
import { termMonthList, currentAnchorYear } from "../../components/attendance-calendar-panel";

afterEach(() => {
  vi.useRealTimers();
});

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

  it("currentAnchorYear Güz'de Temmuz-Aralık aralığında yaklaşan/içinde bulunulan takvim yılını, Ocak-Haziran'da bir önceki yılı döner", () => {
    // Düzeltme: Temmuz/Ağustos (yaz tatili) artık "geçen yılın bitmiş
    // Güz dönemi"ne değil, yaklaşan yeni Güz dönemine (bu Eylül'den
    // başlayan) çapalanır — aksi halde Temmuz/Ağustos'ta takvim, o anda
    // hiçbir güncel/yaklaşan ders içermeyen kapanmış bir aralık gösterir.
    const now = new Date();
    const expected = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    expect(currentAnchorYear("guz")).toBe(expected);
  });

  it("currentAnchorYear Yaz'da her zaman içinde bulunulan takvim yılını döner", () => {
    expect(currentAnchorYear("yaz")).toBe(new Date().getFullYear());
  });

  it("düzeltme: Ağustos'ta (yoklama takviminde veri gelmiyor hatası) Güz çapası yaklaşan yılı gösterir", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00"));
    expect(currentAnchorYear("guz")).toBe(2026);
    const months = termMonthList("guz", currentAnchorYear("guz"));
    expect(months[0]).toEqual({ year: 2026, month: 9 });
  });

  it("Ocak-Haziran'da Güz çapası hâlâ önceki yıl (devam eden dönem) döner", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00"));
    expect(currentAnchorYear("guz")).toBe(2025);
  });

  it("Eylül'de Güz çapası içinde bulunulan yıl döner", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00"));
    expect(currentAnchorYear("guz")).toBe(2026);
  });
});
