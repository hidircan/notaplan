/**
 * Paket 7 — Yönetici ders süre raporu. Saf fonksiyon (I/O yok): planlanan
 * süre her zaman `endAt - startAt`'tan türetilir; gerçekleşen süre
 * `actualEndAt - actualStartAt`'tan (ikisi de doluysa). Fark = gerçekleşen -
 * planlanan (dakika, pozitifse uzun sürmüş, negatifse kısa kesilmiş).
 */
import type { Lesson } from "./types";

export type LessonDurationRow = {
  lessonId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  plannedMinutes: number;
  actualStartAt?: string;
  actualEndAt?: string;
  actualMinutes?: number;
  /** Dakika — gerçekleşen - planlanan. Ders henüz bitmemişse undefined. */
  diffMinutes?: number;
};

export function computeLessonDurationRow(
  lesson: Pick<Lesson, "id" | "startAt" | "endAt" | "actualStartAt" | "actualEndAt">
): LessonDurationRow {
  const plannedMinutes = Math.round(
    (new Date(lesson.endAt).getTime() - new Date(lesson.startAt).getTime()) / 60_000
  );
  const actualMinutes =
    lesson.actualStartAt && lesson.actualEndAt
      ? Math.round((new Date(lesson.actualEndAt).getTime() - new Date(lesson.actualStartAt).getTime()) / 60_000)
      : undefined;
  return {
    lessonId: lesson.id,
    plannedStartAt: lesson.startAt,
    plannedEndAt: lesson.endAt,
    plannedMinutes,
    actualStartAt: lesson.actualStartAt,
    actualEndAt: lesson.actualEndAt,
    actualMinutes,
    diffMinutes: actualMinutes !== undefined ? actualMinutes - plannedMinutes : undefined,
  };
}
