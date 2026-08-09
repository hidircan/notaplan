import { describe, expect, it } from "vitest";
import {
  weeklyClosedDaysForTerm,
  isWeeklyClosedDayForTerm,
  resolveDayStatus,
  FALL_WEEKLY_CLOSED_DAYS,
  SUMMER_WEEKLY_CLOSED_DAYS,
} from "../attendance-calendar";

/**
 * Paket 6 — Çalışma Takvimi: dönem bazlı haftalık kapalı gün kuralı artık
 * `SchoolSettings.termWeeklyClosedDays` ile özelleştirilebilir. Override
 * verilmezse mevcut sabit varsayılanlar (Güz: Pazartesi, Yaz: Cts/Paz)
 * DEĞİŞMEDEN korunur — bu dosya hem eski davranışın hem yeni override'ın
 * doğru çalıştığını doğrular.
 */
describe("weeklyClosedDaysForTerm — özelleştirme yoksa mevcut sabit davranış korunur", () => {
  it("override verilmezse sabit varsayılanları döner", () => {
    expect(weeklyClosedDaysForTerm("guz")).toEqual(FALL_WEEKLY_CLOSED_DAYS);
    expect(weeklyClosedDaysForTerm("yaz")).toEqual(SUMMER_WEEKLY_CLOSED_DAYS);
  });
});

describe("weeklyClosedDaysForTerm — özelleştirme verilince onu kullanır", () => {
  it("örnek: Yazın Pazartesi açık/hafta sonu kapalı, Güzün tersi", () => {
    const override = { guz: [1], yaz: [0, 6] };
    expect(weeklyClosedDaysForTerm("yaz", override)).toEqual([0, 6]);
    expect(weeklyClosedDaysForTerm("guz", override)).toEqual([1]);
  });

  it("okul farklı bir kural tanımlarsa (ör. Yazın hafta sonu açık, Güzün Pazartesi+Salı kapalı) onu kullanır", () => {
    const override = { guz: [1, 2], yaz: [] };
    expect(weeklyClosedDaysForTerm("yaz", override)).toEqual([]);
    expect(weeklyClosedDaysForTerm("guz", override)).toEqual([1, 2]);
  });
});

describe("isWeeklyClosedDayForTerm — override ile", () => {
  const override = { guz: [1], yaz: [0, 6] };
  const monday = new Date("2026-08-10T12:00:00"); // Pazartesi
  const saturday = new Date("2026-08-08T12:00:00"); // Cumartesi

  it("yaz döneminde Pazartesi artık kapalı DEĞİL (override ile açık)", () => {
    expect(isWeeklyClosedDayForTerm(monday, "yaz", override)).toBe(false);
  });

  it("yaz döneminde hafta sonu kapalı", () => {
    expect(isWeeklyClosedDayForTerm(saturday, "yaz", override)).toBe(true);
  });

  it("güz döneminde Pazartesi hâlâ kapalı", () => {
    expect(isWeeklyClosedDayForTerm(monday, "guz", override)).toBe(true);
  });
});

describe("resolveDayStatus — override thread edilir", () => {
  it("override ile yaz döneminde Pazartesi 'open' döner", () => {
    const monday = new Date("2026-08-10T12:00:00");
    const result = resolveDayStatus(monday, "yaz", [], { guz: [1], yaz: [] });
    expect(result.status).toBe("open");
  });

  it("override yokken yaz döneminde Pazartesi zaten açık (sabit varsayılan da öyle)", () => {
    const monday = new Date("2026-08-10T12:00:00");
    const result = resolveDayStatus(monday, "yaz", []);
    expect(result.status).toBe("open");
  });

  it("override yokken yaz döneminde Cumartesi kapalı (sabit varsayılan)", () => {
    const saturday = new Date("2026-08-08T12:00:00");
    const result = resolveDayStatus(saturday, "yaz", []);
    expect(result.status).toBe("closed");
    expect(result.reason).toBe("term_weekly_closed");
  });

  it("manuel istisna (ClosedDay isOpen:true) hâlâ en yüksek önceliğe sahip", () => {
    const saturday = new Date("2026-08-08T12:00:00");
    const result = resolveDayStatus(saturday, "yaz", [{ date: "2026-08-08", isOpen: true, name: "Özel açık gün" }], {
      guz: [1],
      yaz: [0, 6],
    });
    expect(result.status).toBe("open");
    expect(result.reason).toBe("manual_open");
  });
});
