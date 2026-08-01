import { differenceInMinutes, parseISO } from "date-fns";
import type { AppData, Lesson } from "./types";
import { validateLessonSlot, type SlotValidationCode } from "./makeup-engine";

export type LessonUpdateErrorCode = SlotValidationCode | "LESSON_NOT_FOUND" | "LESSON_NOT_EDITABLE";

export type LessonUpdateResult =
  | { ok: true; data: AppData; lesson: Lesson }
  | { ok: false; code: LessonUpdateErrorCode; message: string };

function findEditableLesson(
  data: AppData,
  lessonId: string
): { ok: true; lesson: Lesson } | { ok: false; code: LessonUpdateErrorCode; message: string } {
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    return { ok: false, code: "LESSON_NOT_FOUND", message: "Ders bulunamadı." };
  }
  if (lesson.type !== "regular") {
    return {
      ok: false,
      code: "LESSON_NOT_EDITABLE",
      message: "Yalnızca normal dersler taşınabilir, süresi değiştirilebilir veya iptal edilebilir.",
    };
  }
  if (lesson.status !== "scheduled") {
    return {
      ok: false,
      code: "LESSON_NOT_EDITABLE",
      message: "Bu ders zaten tamamlanmış veya iptal edilmiş.",
    };
  }
  return { ok: true, lesson };
}

/**
 * Ders taşıma (startAt değişir, süre korunur) ve süre değiştirme (startAt aynı
 * kalır, süre değişir) için TEK ortak yol. Her iki durumda da nihai kararı
 * `validateLessonSlot` verir — çakışma/uygunluk/çalışma saati kuralları burada
 * tekrar yazılmaz. Sürükle-bırak, resize ve gelecekteki manuel "dersi taşı"
 * formu bu fonksiyonu paylaşır.
 */
export function applyLessonScheduleUpdate(
  data: AppData,
  input: { lessonId: string; startAt?: string; durationMinutes?: number },
  now: Date = new Date()
): LessonUpdateResult {
  const found = findEditableLesson(data, input.lessonId);
  if (!found.ok) return found;
  const { lesson } = found;

  const currentStart = parseISO(lesson.startAt);
  if (currentStart.getTime() <= now.getTime()) {
    return {
      ok: false,
      code: "LESSON_NOT_EDITABLE",
      message: "Geçmiş bir ders taşınamaz veya süresi değiştirilemez.",
    };
  }

  const currentDuration = differenceInMinutes(parseISO(lesson.endAt), currentStart);
  const newStartAt = input.startAt ?? lesson.startAt;
  const newDuration = input.durationMinutes ?? currentDuration;

  const validation = validateLessonSlot(
    data,
    { instrument: lesson.instrument, studentId: lesson.studentId },
    { teacherId: lesson.teacherId, roomId: lesson.roomId, startAt: newStartAt },
    { excludeLessonId: lesson.id, now, durationMinutes: newDuration }
  );
  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  const updatedLesson: Lesson = {
    ...lesson,
    startAt: validation.slot.startAt,
    endAt: validation.slot.endAt,
  };
  const lessons = data.lessons.map((l) => (l.id === lesson.id ? updatedLesson : l));
  return { ok: true, data: { ...data, lessons }, lesson: updatedLesson };
}

export function applyLessonCancel(data: AppData, lessonId: string): LessonUpdateResult {
  const found = findEditableLesson(data, lessonId);
  if (!found.ok) return found;
  const { lesson } = found;

  const updatedLesson: Lesson = { ...lesson, status: "cancelled" };
  const lessons = data.lessons.map((l) => (l.id === lesson.id ? updatedLesson : l));
  return { ok: true, data: { ...data, lessons }, lesson: updatedLesson };
}
