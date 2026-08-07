import { describe, it, expect } from "vitest";
import {
  resolveDayStatus,
  termMonths,
  isDateWithinTermCalendar,
  clampSummerExtensionDay,
  weeklyClosedDaysForTerm,
} from "../attendance-calendar";

describe("ÖNCELİK 4 — attendance-calendar", () => {
  it("Güz döneminde Pazartesi kapalıdır", () => {
    // 2026-08-10 bir Pazartesi
    const r = resolveDayStatus(new Date(2026, 7, 10, 12), "guz", []);
    expect(r.status).toBe("closed");
    expect(r.reason).toBe("term_weekly_closed");
  });

  it("Güz döneminde Salı açıktır", () => {
    // 2026-08-11 bir Salı
    const r = resolveDayStatus(new Date(2026, 7, 11, 12), "guz", []);
    expect(r.status).toBe("open");
  });

  it("Yaz döneminde Cumartesi ve Pazar kapalıdır", () => {
    // 2026-08-08 Cumartesi, 2026-08-09 Pazar
    const sat = resolveDayStatus(new Date(2026, 7, 8, 12), "yaz", []);
    const sun = resolveDayStatus(new Date(2026, 7, 9, 12), "yaz", []);
    expect(sat.status).toBe("closed");
    expect(sun.status).toBe("closed");
    expect(sat.reason).toBe("term_weekly_closed");
  });

  it("Yaz döneminde hafta içi açıktır", () => {
    const wed = resolveDayStatus(new Date(2026, 7, 12, 12), "yaz", []); // Çarşamba
    expect(wed.status).toBe("open");
  });

  it("resmî tatil kapalıdır (Yılbaşı)", () => {
    const r = resolveDayStatus(new Date(2026, 0, 1, 12), "guz", []);
    expect(r.status).toBe("closed");
    expect(r.reason).toBe("official_holiday");
  });

  it("dini resmî tatil kapalıdır (Ramazan Bayramı 2026)", () => {
    const r = resolveDayStatus(new Date(2026, 2, 20, 12), "guz", []); // 2026-03-20
    expect(r.status).toBe("closed");
    expect(r.reason).toBe("official_holiday");
  });

  it("manuel istisna öncelik sırasında en üsttedir: kapalı gün üzerine zorla-açık kazanır", () => {
    // Yılbaşı (resmî tatil) ama admin zorla açtı
    const overrides = [{ date: "2026-01-01", isOpen: true, name: "Özel açık" }];
    const r = resolveDayStatus(new Date(2026, 0, 1, 12), "guz", overrides);
    expect(r.status).toBe("open");
    expect(r.reason).toBe("manual_open");
  });

  it("manuel istisna açık bir günü kapatabilir", () => {
    // Salı (normalde açık) ama admin kapattı
    const overrides = [{ date: "2026-08-11", isOpen: false, name: "Özel kapalı" }];
    const r = resolveDayStatus(new Date(2026, 7, 11, 12), "guz", overrides);
    expect(r.status).toBe("closed");
    expect(r.reason).toBe("manual_closed");
  });

  it("manuel istisna haftalık kapalı gün kuralının önüne geçer", () => {
    // Pazartesi normalde Güz'de kapalı ama admin zorla açtı
    const overrides = [{ date: "2026-08-10", isOpen: true, name: "Telafi günü" }];
    const r = resolveDayStatus(new Date(2026, 7, 10, 12), "guz", overrides);
    expect(r.status).toBe("open");
    expect(r.reason).toBe("manual_open");
  });

  it("Güz takvimi Eylül–Haziran arası 10 ay kapsar", () => {
    const months = termMonths("guz", 2026);
    expect(months).toHaveLength(10);
    expect(months[0]).toEqual({ year: 2026, month: 9 });
    expect(months.at(-1)).toEqual({ year: 2027, month: 6 });
  });

  it("Yaz takvimi Temmuz-Ağustos, uzatma olmadan 2 ay", () => {
    const months = termMonths("yaz", 2026);
    expect(months).toHaveLength(2);
  });

  it("Yaz takvimi uzatma ile Eylül'ü de kapsar", () => {
    const months = termMonths("yaz", 2026, 10);
    expect(months).toHaveLength(3);
    expect(months.at(-1)).toEqual({ year: 2026, month: 9 });
  });

  it("yaz uzatması Eylülün 2. haftasını aşamaz (14 gün ile sınırlanır)", () => {
    expect(clampSummerExtensionDay(30)).toBe(14);
    expect(clampSummerExtensionDay(5)).toBe(5);
    expect(clampSummerExtensionDay(0)).toBe(0);
  });

  it("Eylül ayında uzatma sınırının ötesindeki günler dönem takviminde geçersizdir", () => {
    expect(isDateWithinTermCalendar("2026-09-05", "yaz", 10)).toBe(true);
    expect(isDateWithinTermCalendar("2026-09-12", "yaz", 10)).toBe(false);
    expect(isDateWithinTermCalendar("2026-09-05", "yaz", 0)).toBe(false);
  });

  it("weeklyClosedDaysForTerm doğru günleri döner", () => {
    expect(weeklyClosedDaysForTerm("guz")).toEqual([1]);
    expect(weeklyClosedDaysForTerm("yaz")).toEqual([0, 6]);
  });
});
