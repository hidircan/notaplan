/**
 * ÖNCELİK 4 — Yıllık Yoklama Takvimi: dönem/takvim ay aralığı + gün durumu
 * (statü) çözümleme. Saf fonksiyonlar — I/O yok, store'dan bağımsız test
 * edilebilir (bkz. src/lib/__tests__/attendance-calendar.test.ts).
 *
 * Statü öncelik sırası (KESİN):
 *   1) Manuel admin istisnası (ClosedDay — kapalı VEYA zorla açık)
 *   2) Resmî tatil (turkishOfficialHolidays)
 *   3) Dönemin haftalık kapalı gün kuralı (Güz: Pazartesi; Yaz: Cts/Paz)
 *   4) Açık gün
 */

import type { ClosedDay, StudentTermType } from "./types";
import { findOfficialHoliday } from "./turkish-holidays";
import { toYmd } from "./closed-days";

export type DayStatus = "closed" | "open";

export type DayStatusReason =
  | "manual_closed"
  | "manual_open"
  | "official_holiday"
  | "term_weekly_closed"
  | "open";

export type DayStatusResolution = {
  date: string; // yyyy-MM-dd
  status: DayStatus;
  reason: DayStatusReason;
  label: string;
};

/** Güz dönemi: haftanın Pazartesi günü (1) varsayılan kapalı. */
export const FALL_WEEKLY_CLOSED_DAYS: number[] = [1];
/** Yaz dönemi: Cumartesi(6) + Pazar(0) varsayılan kapalı. */
export const SUMMER_WEEKLY_CLOSED_DAYS: number[] = [0, 6];

export function weeklyClosedDaysForTerm(term: StudentTermType): number[] {
  return term === "yaz" ? SUMMER_WEEKLY_CLOSED_DAYS : FALL_WEEKLY_CLOSED_DAYS;
}

/**
 * Bir dönemin varsayılan takvim ay aralığı (yıl bağımsız, ay indeksleri
 * 1–12). Güz: Eylül(9)–Haziran(6, bir sonraki takvim yılına taşar).
 * Yaz: Temmuz(7)–Ağustos(8) + opsiyonel uzatma (Eylülün 2. haftasına kadar).
 */
export type TermMonth = { year: number; month: number }; // month: 1-12

/**
 * @param anchorYear Güz için "başlangıç" takvim yılı (ör. 2026 -> Eylül 2026–
 *   Haziran 2027). Yaz için o yazın takvim yılı.
 * @param summerExtensionEndDay Yaz döneminde Eylül ayına uzatılan gün sayısı
 *   (1–14 arası, "Eylülün ikinci haftasına kadar" kısıtı — varsayılan 0).
 */
export function termMonths(
  term: StudentTermType,
  anchorYear: number,
  summerExtensionEndDay = 0
): TermMonth[] {
  if (term === "yaz") {
    const months: TermMonth[] = [
      { year: anchorYear, month: 7 },
      { year: anchorYear, month: 8 },
    ];
    if (summerExtensionEndDay > 0) {
      months.push({ year: anchorYear, month: 9 });
    }
    return months;
  }
  // guz: Eylül(anchorYear) .. Haziran(anchorYear+1)
  const months: TermMonth[] = [];
  for (let m = 9; m <= 12; m++) months.push({ year: anchorYear, month: m });
  for (let m = 1; m <= 6; m++) months.push({ year: anchorYear + 1, month: m });
  return months;
}

/** Yaz uzatma sınırı: Eylülün en fazla 14. gününe kadar (2. hafta sonu). */
export const MAX_SUMMER_EXTENSION_DAY = 14;

export function clampSummerExtensionDay(day: number): number {
  if (!Number.isFinite(day) || day <= 0) return 0;
  return Math.min(Math.round(day), MAX_SUMMER_EXTENSION_DAY);
}

/**
 * Bir tarihin dönem takvimi içinde "geçerli" olup olmadığını (yaz uzatmasının
 * Eylül ayında sınırını aşıp aşmadığını) kontrol eder. Güz'de her zaman true
 * (tüm ay geçerli); Yaz'da Eylül ayı yalnızca uzatma gününe kadar geçerlidir.
 */
export function isDateWithinTermCalendar(
  dateYmd: string,
  term: StudentTermType,
  summerExtensionEndDay = 0
): boolean {
  if (term !== "yaz") return true;
  const day = Number(dateYmd.slice(8, 10));
  const month = Number(dateYmd.slice(5, 7));
  if (month !== 9) return true; // Temmuz/Ağustos her zaman geçerli
  const ext = clampSummerExtensionDay(summerExtensionEndDay);
  return ext > 0 && day <= ext;
}

/**
 * Bir günün nihai statüsünü — manuel istisna > resmî tatil > dönem haftalık
 * kuralı > açık — sırasıyla çözer.
 */
export function resolveDayStatus(
  date: Date,
  term: StudentTermType,
  manualOverrides: Pick<ClosedDay, "date" | "isOpen" | "name">[]
): DayStatusResolution {
  const ymd = toYmd(date);

  // 1) Manuel admin istisnası — en yüksek öncelik.
  const manual = manualOverrides.find((o) => o.date === ymd);
  if (manual) {
    return manual.isOpen
      ? { date: ymd, status: "open", reason: "manual_open", label: manual.name || "Zorla açık" }
      : { date: ymd, status: "closed", reason: "manual_closed", label: manual.name || "Kapalı (yönetici)" };
  }

  // 2) Resmî tatil.
  const holiday = findOfficialHoliday(ymd);
  if (holiday) {
    return { date: ymd, status: "closed", reason: "official_holiday", label: holiday.name };
  }

  // 3) Dönemin haftalık kapalı gün kuralı.
  const weekday = date.getDay(); // 0=Pazar..6=Cumartesi
  if (weeklyClosedDaysForTerm(term).includes(weekday)) {
    const label = term === "yaz" ? "Hafta sonu (Yaz dönemi kapalı)" : "Pazartesi (Güz dönemi kapalı)";
    return { date: ymd, status: "closed", reason: "term_weekly_closed", label };
  }

  // 4) Açık gün.
  return { date: ymd, status: "open", reason: "open", label: "Açık" };
}

/** Tüm ay için gün gün statü listesi üretir (UI ay kutusu render'ı için). */
export function resolveMonthStatuses(
  year: number,
  month: number, // 1-12
  term: StudentTermType,
  manualOverrides: Pick<ClosedDay, "date" | "isOpen" | "name">[]
): DayStatusResolution[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const results: DayStatusResolution[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d, 12, 0, 0);
    results.push(resolveDayStatus(date, term, manualOverrides));
  }
  return results;
}

/** UI renk sözlüğü — Geldi yeşil, İşlendi kırmızı, Telafi sarı, Kapalı siyah. */
export const ATTENDANCE_CALENDAR_COLORS = {
  came: "#16a34a", // green-600 — Geldi
  processed: "#dc2626", // red-600 — İşlendi
  makeup: "#ca8a04", // yellow-600 — Telafi
  closed: "#0a0a0a", // near-black — Kapalı
  open: "#e5e7eb", // gray-200 — Açık, işaretsiz
} as const;
