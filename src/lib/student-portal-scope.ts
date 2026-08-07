import type { Lesson } from "./types";

/**
 * ÖNCELİK 4 (devam) — Öğrenci portalı erişim sınırlaması. `teacher-portal-scope.ts`
 * ile aynı desen: saf yardımcı, "bu ders gerçekten bu öğrenciye mi ait"
 * sorusunu yanıtlar. Sunucu tarafında `session.studentId`'den (asla client
 * girdisinden) çözülen id ile çağrılmalıdır — URL/API'den başka bir
 * studentId verilse bile bu fonksiyon yalnızca kendi dersini döner.
 */

/** `weekStartIso` dahil, `weekEndIso` hariç aralıktaki, yalnızca bu öğrencinin dersleri. */
export function ownStudentWeekLessons(
  lessons: Lesson[],
  studentId: string,
  weekStartIso: string,
  weekEndIso: string
): Lesson[] {
  return lessons
    .filter((l) => l.studentId === studentId && l.startAt >= weekStartIso && l.startAt < weekEndIso)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}
