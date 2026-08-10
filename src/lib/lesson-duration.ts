/**
 * Ders süresi sabitleri — tek doğrulama/varsayılan kaynağı. `Student.
 * lessonDurationMinutes` (types.ts `LessonDurationPreference`) ve ders/paket
 * fiyatlandırma akışlarının (Package.price30Min/40Min/50Min) hepsi aynı
 * sabit üç değeri (30/40/50 dk) kullanır — deneme dersleri (trial lesson)
 * bu kısıtlamaya tabi DEĞİLDİR (bkz. validation.ts createTrialLessonSchema
 * yorumu), o yüzden bu modül yalnızca DÜZENLİ ders/paket akışları içindir.
 */

export const LESSON_DURATION_OPTIONS = [30, 40, 50] as const;
export type LessonDurationMinutes = (typeof LESSON_DURATION_OPTIONS)[number];

/** Paket/ders formlarında varsayılan seçili süre. */
export const DEFAULT_LESSON_DURATION_MINUTES: LessonDurationMinutes = 40;
