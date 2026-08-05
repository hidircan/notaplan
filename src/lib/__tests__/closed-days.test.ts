import { describe, it, expect } from "vitest";
import {
  CALENDAR_START_HOUR,
  isDateClosed,
  isMonday,
  turkeyFixedPublicHolidays,
} from "../closed-days";

describe("Monday closed", () => {
  it("Pazartesi kapalı", () => {
    // 2026-08-03 is Monday
    expect(isMonday(new Date("2026-08-03T12:00:00+03:00"))).toBe(true);
    const r = isDateClosed("2026-08-03T14:00:00+03:00", []);
    expect(r.closed).toBe(true);
    expect(r.reason).toMatch(/Pazartesi/i);
  });

  it("Salı açık (tatil yoksa)", () => {
    const r = isDateClosed("2026-08-04T14:00:00+03:00", []);
    expect(r.closed).toBe(false);
  });
});

describe("closed days + holidays", () => {
  it("özel kapalı gün", () => {
    const r = isDateClosed("2026-08-10T11:00:00+03:00", [{ date: "2026-08-10" }]);
    expect(r.closed).toBe(true);
  });

  it("Türkiye sabit tatilleri yıl için üretir", () => {
    const h = turkeyFixedPublicHolidays(2026);
    expect(h.find((x) => x.date === "2026-10-29")?.name).toMatch(/Cumhuriyet/);
  });

  it("takvim 10:00 başlar sabiti", () => {
    expect(CALENDAR_START_HOUR).toBe(10);
  });
});
