/**
 * Geldi / İşlendi / Telafi — ayrı, kalıcı operasyonel bayraklar (tek enum değil).
 * - Geldi: öğrenci katıldı; dersi otomatik tamamlamaz
 * - İşlendi: ders fiilen işlendi → hakediş kaynağı (status completed)
 * - Telafi: telafi akışına alındı (kırmızı)
 */

import type { AppData, Attendance, Lesson, MakeupRequest } from "./types";
import { uid } from "./utils";
import { addDays, formatISO } from "date-fns";

export type LessonOpsFlag = "attended" | "processed" | "makeup";

export type LessonOpsPatch = Partial<
  Pick<
    Lesson,
    | "studentAttended"
    | "studentAttendedAt"
    | "studentAttendedBy"
    | "lessonProcessed"
    | "lessonProcessedAt"
    | "lessonProcessedBy"
    | "opsMakeupFlag"
    | "opsMakeupFlagAt"
    | "opsMakeupFlagBy"
    | "status"
    | "actualEndAt"
  >
>;

export type ApplyLessonOpsResult =
  | {
      ok: true;
      alreadySet: boolean;
      data: AppData;
      lesson: Lesson;
      message: string;
    }
  | { ok: false; message: string };

export function isLessonProcessedForPayout(lesson: Pick<Lesson, "status" | "lessonProcessed">): boolean {
  // İşlendi bayrağı birincil; yoksa legacy completed
  if (lesson.lessonProcessed === true) return true;
  if (lesson.lessonProcessed === false) return false;
  return lesson.status === "completed";
}

export function applyLessonOpsFlag(
  data: AppData,
  lessonId: string,
  flag: LessonOpsFlag,
  actorUserId: string,
  now: Date = new Date()
): ApplyLessonOpsResult {
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson) return { ok: false, message: "Ders bulunamadı." };

  const nowIso = now.toISOString();

  if (flag === "attended") {
    if (lesson.studentAttended) {
      return {
        ok: true,
        alreadySet: true,
        data,
        lesson,
        message: "Geldi zaten işaretli.",
      };
    }
    const patch: LessonOpsPatch = {
      studentAttended: true,
      studentAttendedAt: nowIso,
      studentAttendedBy: actorUserId,
    };
    let attendances = data.attendances.filter((a) => a.lessonId !== lessonId);
    const attendance: Attendance = {
      id: uid("att"),
      lessonId,
      studentId: lesson.studentId,
      status: "present",
      markedAt: nowIso,
      createsMakeupCredit: false,
    };
    attendances = [...attendances, attendance];
    const lessons = data.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l));
    const next = { ...data, lessons, attendances };
    const nextLesson = lessons.find((l) => l.id === lessonId)!;
    return {
      ok: true,
      alreadySet: false,
      data: next,
      lesson: nextLesson,
      message: "Geldi işaretlendi.",
    };
  }

  if (flag === "processed") {
    if (lesson.lessonProcessed && lesson.status === "completed") {
      return {
        ok: true,
        alreadySet: true,
        data,
        lesson,
        message: "İşlendi zaten işaretli.",
      };
    }
    const patch: LessonOpsPatch = {
      lessonProcessed: true,
      lessonProcessedAt: nowIso,
      lessonProcessedBy: actorUserId,
      status: "completed",
      actualEndAt: lesson.actualEndAt ?? nowIso,
    };
    const lessons = data.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l));
    const next = { ...data, lessons };
    return {
      ok: true,
      alreadySet: false,
      data: next,
      lesson: lessons.find((l) => l.id === lessonId)!,
      message: "İşlendi işaretlendi.",
    };
  }

  // makeup
  if (lesson.opsMakeupFlag) {
    return {
      ok: true,
      alreadySet: true,
      data,
      lesson,
      message: "Telafi zaten işaretli.",
    };
  }
  const patch: LessonOpsPatch = {
    opsMakeupFlag: true,
    opsMakeupFlagAt: nowIso,
    opsMakeupFlagBy: actorUserId,
  };
  const lessons = data.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l));

  let makeupRequests = data.makeupRequests;
  const existingMk = makeupRequests.find(
    (m) => m.sourceLessonId === lessonId && m.status !== "cancelled" && m.status !== "expired"
  );
  if (!existingMk) {
    const branch = data.settings.branches.find((b) => b.id === lesson.branchId);
    const req: MakeupRequest = {
      id: uid("mk"),
      studentId: lesson.studentId,
      teacherId: lesson.teacherId,
      branchId: lesson.branchId,
      instrument: lesson.instrument,
      sourceLessonId: lesson.id,
      attendanceId: data.attendances.find((a) => a.lessonId === lessonId)?.id ?? uid("att"),
      status: "pending",
      reason: "Program/yoklama — Telafi işaretlendi",
      expiresAt: formatISO(addDays(now, data.settings.makeupWindowDays)),
      suggestedSlots: [],
      createdAt: nowIso,
      policyNote: `${data.settings.makeupWindowDays} gün · ${branch?.shortName ?? ""}`,
    };
    makeupRequests = [...makeupRequests, req];
  }

  const next = { ...data, lessons, makeupRequests };
  return {
    ok: true,
    alreadySet: false,
    data: next,
    lesson: lessons.find((l) => l.id === lessonId)!,
    message: "Telafi işaretlendi.",
  };
}
