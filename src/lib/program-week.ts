import { startOfWeek, addDays, format, parseISO, isValid } from "date-fns";

const WEEK_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `?week=` query değerini pazartesiye normalize eder. Geçersiz/eksik
 * değerde veya format uyuşmazlığında `referenceNow`'un içinde bulunduğu
 * haftaya düşer — asla hata fırlatmaz, asla geçersiz bir tarihe gitmez.
 */
export function normalizeWeekStart(input: string | undefined, referenceNow: Date = new Date()): Date {
  if (input && WEEK_PARAM_PATTERN.test(input)) {
    const parsed = parseISO(input);
    if (isValid(parsed)) {
      return startOfWeek(parsed, { weekStartsOn: 1 });
    }
  }
  return startOfWeek(referenceNow, { weekStartsOn: 1 });
}

/** Bir hafta başlangıcını `?week=` query'sinde kullanılacak "yyyy-MM-dd" biçimine çevirir. */
export function weekParam(weekStart: Date): string {
  return format(weekStart, "yyyy-MM-dd");
}

export function previousWeekParam(weekStart: Date): string {
  return weekParam(addDays(weekStart, -7));
}

export function nextWeekParam(weekStart: Date): string {
  return weekParam(addDays(weekStart, 7));
}

export function todayWeekParam(referenceNow: Date = new Date()): string {
  return weekParam(startOfWeek(referenceNow, { weekStartsOn: 1 }));
}

/** Seçili hafta, `referenceNow`'un içinde bulunduğu hafta ile aynı mı? */
export function isCurrentWeek(weekStart: Date, referenceNow: Date = new Date()): boolean {
  return weekParam(weekStart) === todayWeekParam(referenceNow);
}
