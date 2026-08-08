import { describe, it, expect } from "vitest";
import {
  resolveDayStatus,
  termMonths,
  isDateWithinTermCalendar,
  clampSummerExtensionDay,
  weeklyClosedDaysForTerm,
  resolveLessonAcademicPeriod,
  lessonMatchesAcademicPeriod,
  mondayFirstWeekdayIndex,
  leadingBlankDayCount,
  trailingBlankDayCount,
  resolveAttendanceCalendarStudentId,
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

describe("ÖNCELİK 4 (devam) — resolveLessonAcademicPeriod (Program dönem/yıl)", () => {
  it("ders üzerinde term/academicYearStart AÇIKÇA set edilmişse onu kullanır (legacy fallback'a bakmaz)", () => {
    const r = resolveLessonAcademicPeriod({
      startAt: "2026-01-15T10:00:00.000Z", // Ocak — fallback Güz derdi ama açık alan Yaz diyor
      term: "yaz",
      academicYearStart: 2025,
    });
    expect(r).toEqual({ term: "yaz", academicYearStart: 2025, source: "explicit" });
  });

  it("legacy (term=undefined) bir Eylül dersi, öğrenci Güz ise Güz'ün başlangıcı sayılır", () => {
    const r = resolveLessonAcademicPeriod({ startAt: "2026-09-10T10:00:00.000Z" }, "guz");
    expect(r.term).toBe("guz");
    expect(r.academicYearStart).toBe(2026);
    expect(r.source).toBe("legacy_fallback");
  });

  it("legacy bir Ekim/Kasım dersi her zaman Güz'ün devamı sayılır (akademik yıl bir önceki Eylül)", () => {
    const r = resolveLessonAcademicPeriod({ startAt: "2027-01-15T10:00:00.000Z" }, "guz");
    expect(r.term).toBe("guz");
    expect(r.academicYearStart).toBe(2026); // 2026 Eylül - 2027 Haziran dönemi
  });

  it("legacy bir Temmuz/Ağustos dersi Yaz sayılır", () => {
    const r = resolveLessonAcademicPeriod({ startAt: "2026-07-20T10:00:00.000Z" }, "guz");
    expect(r.term).toBe("yaz");
    expect(r.academicYearStart).toBe(2026);
  });

  it("legacy bir Eylül dersi, öğrenci Yaz ise (uzatma) Yaz'ın devamı sayılır", () => {
    const r = resolveLessonAcademicPeriod({ startAt: "2026-09-05T10:00:00.000Z" }, "yaz");
    expect(r.term).toBe("yaz");
    expect(r.academicYearStart).toBe(2026);
  });

  it("lessonMatchesAcademicPeriod legacy dersleri fallback üzerinden doğru eşleştirir (sessizce dışlamaz)", () => {
    const legacyLesson = { startAt: "2026-10-01T10:00:00.000Z" };
    expect(lessonMatchesAcademicPeriod(legacyLesson, "guz", 2026, "guz")).toBe(true);
    expect(lessonMatchesAcademicPeriod(legacyLesson, "yaz", 2026, "guz")).toBe(false);
  });

  it("Güz dersinin Yaz döneminde görünmemesi — açık term ile etiketli ders başka dönemle eşleşmez", () => {
    const guzLesson = { startAt: "2026-10-01T10:00:00.000Z", term: "guz" as const, academicYearStart: 2026 };
    expect(lessonMatchesAcademicPeriod(guzLesson, "yaz", 2026)).toBe(false);
    expect(lessonMatchesAcademicPeriod(guzLesson, "guz", 2026)).toBe(true);
  });
});

describe("Yoklama Takvimi — Pazartesi başlangıçlı ay grid hizalaması", () => {
  it("Pazartesi=0, Pazar=6 sütun indeksine çevrilir", () => {
    expect(mondayFirstWeekdayIndex(new Date(2026, 7, 10))).toBe(0); // 2026-08-10 Pazartesi
    expect(mondayFirstWeekdayIndex(new Date(2026, 7, 16))).toBe(6); // 2026-08-16 Pazar
  });

  it("ayın 1. günü Pazartesi ise boş öncü hücre yok", () => {
    // 2026-08-01 bir Cumartesi (kontrol için de doğrulanır)
    expect(leadingBlankDayCount(2026, 8)).toBe(mondayFirstWeekdayIndex(new Date(2026, 7, 1)));
  });

  it("2026 Eylül 1. günü Salı — grid'de Pazartesi'den sonra 1 boş hücre olmalı", () => {
    // 2026-09-01 bir Salı
    expect(leadingBlankDayCount(2026, 9)).toBe(1);
  });

  it("öncü + ayın gün sayısı + artçı boşluk her zaman 7'nin katıdır", () => {
    for (const [year, month] of [[2026, 2], [2026, 9], [2027, 1], [2024, 2]] as const) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const total = leadingBlankDayCount(year, month) + daysInMonth + trailingBlankDayCount(year, month);
      expect(total % 7).toBe(0);
    }
  });
});

describe("Yoklama Takvimi — studentId param tenant/scope doğrulaması", () => {
  it("scoped listede olan studentId aynen döner", () => {
    expect(resolveAttendanceCalendarStudentId("s1", ["s1", "s2"])).toBe("s1");
  });

  it("scoped listede OLMAYAN (cross-tenant/geçersiz) studentId reddedilir — null döner", () => {
    expect(resolveAttendanceCalendarStudentId("cross-tenant-id", ["s1", "s2"])).toBeNull();
  });

  it("studentId verilmemişse null döner (seçici gösterilir)", () => {
    expect(resolveAttendanceCalendarStudentId(null, ["s1"])).toBeNull();
    expect(resolveAttendanceCalendarStudentId(undefined, ["s1"])).toBeNull();
  });
});
