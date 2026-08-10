import { describe, it, expect } from "vitest";
import {
  normalizeWeekStart,
  weekParam,
  previousWeekParam,
  nextWeekParam,
  todayWeekParam,
  isCurrentWeek,
} from "../program-week";

// 2026-08-05 bir Çarşamba — o haftanın pazartesisi 2026-08-03 olmalı.
const WEDNESDAY = new Date(2026, 7, 5);
const MONDAY_OF_THAT_WEEK = "2026-08-03";

describe("normalizeWeekStart — hafta normalizasyonu", () => {
  it("hafta ortasındaki herhangi bir günü o haftanın pazartesisine normalize eder", () => {
    const result = normalizeWeekStart("2026-08-05");
    expect(weekParam(result)).toBe(MONDAY_OF_THAT_WEEK);
  });

  it("zaten pazartesi olan bir tarihi olduğu gibi bırakır", () => {
    const result = normalizeWeekStart(MONDAY_OF_THAT_WEEK);
    expect(weekParam(result)).toBe(MONDAY_OF_THAT_WEEK);
  });

  it("pazar gününü bir önceki haftanın pazartesisine normalize eder", () => {
    // 2026-08-09 Pazar — 2026-08-03 haftasının son günü.
    const result = normalizeWeekStart("2026-08-09");
    expect(weekParam(result)).toBe(MONDAY_OF_THAT_WEEK);
  });

  it("değer verilmezse referans tarihin haftasına düşer", () => {
    const result = normalizeWeekStart(undefined, WEDNESDAY);
    expect(weekParam(result)).toBe(MONDAY_OF_THAT_WEEK);
  });

  it("geçersiz formatta değer verilirse hata fırlatmadan referans haftaya düşer", () => {
    const result = normalizeWeekStart("not-a-date", WEDNESDAY);
    expect(weekParam(result)).toBe(MONDAY_OF_THAT_WEEK);
  });

  it("format uyuyor ama geçersiz takvim tarihinde referans haftaya düşer", () => {
    const result = normalizeWeekStart("2026-13-40", WEDNESDAY);
    expect(weekParam(result)).toBe(MONDAY_OF_THAT_WEEK);
  });

  it("boş string verilirse referans haftaya düşer", () => {
    const result = normalizeWeekStart("", WEDNESDAY);
    expect(weekParam(result)).toBe(MONDAY_OF_THAT_WEEK);
  });
});

describe("previousWeekParam / nextWeekParam", () => {
  it("önceki hafta tam 7 gün geriye gider", () => {
    const weekStart = normalizeWeekStart(MONDAY_OF_THAT_WEEK);
    expect(previousWeekParam(weekStart)).toBe("2026-07-27");
  });

  it("sonraki hafta tam 7 gün ileriye gider", () => {
    const weekStart = normalizeWeekStart(MONDAY_OF_THAT_WEEK);
    expect(nextWeekParam(weekStart)).toBe("2026-08-10");
  });

  it("önceki ve sonraki hafta parametreleri normalizeWeekStart'a geri verildiğinde tutarlıdır", () => {
    const weekStart = normalizeWeekStart(MONDAY_OF_THAT_WEEK);
    const next = normalizeWeekStart(nextWeekParam(weekStart));
    const backToStart = normalizeWeekStart(previousWeekParam(next));
    expect(weekParam(backToStart)).toBe(MONDAY_OF_THAT_WEEK);
  });
});

describe("todayWeekParam / isCurrentWeek — Bugün dönüşü", () => {
  it("todayWeekParam referans tarihin haftasının pazartesisini döner", () => {
    expect(todayWeekParam(WEDNESDAY)).toBe(MONDAY_OF_THAT_WEEK);
  });

  it("seçili hafta bugünün haftasıysa isCurrentWeek true döner", () => {
    const weekStart = normalizeWeekStart(MONDAY_OF_THAT_WEEK);
    expect(isCurrentWeek(weekStart, WEDNESDAY)).toBe(true);
  });

  it("seçili hafta geçmiş bir haftaysa isCurrentWeek false döner", () => {
    const pastWeekStart = normalizeWeekStart("2026-07-20");
    expect(isCurrentWeek(pastWeekStart, WEDNESDAY)).toBe(false);
  });

  it("seçili hafta gelecek bir haftaysa isCurrentWeek false döner", () => {
    const futureWeekStart = normalizeWeekStart("2026-09-01");
    expect(isCurrentWeek(futureWeekStart, WEDNESDAY)).toBe(false);
  });

  it("'Bugün'e dönüş: todayWeekParam ile normalize edilen hafta her zaman isCurrentWeek=true verir", () => {
    const backToToday = normalizeWeekStart(todayWeekParam(WEDNESDAY), WEDNESDAY);
    expect(isCurrentWeek(backToToday, WEDNESDAY)).toBe(true);
  });
});
