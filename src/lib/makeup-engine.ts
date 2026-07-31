import {
  addDays,
  addMinutes,
  format,
  getDay,
  isBefore,
  isAfter,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import type {
  AppData,
  Lesson,
  MakeupRequest,
  MakeupSlot,
  Room,
  Teacher,
} from "./types";

function parseHm(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return { h, m };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function roomSupports(room: Room, instrument: string) {
  return room.instruments.includes(instrument as Room["instruments"][number]);
}

function teacherFree(
  teacherId: string,
  start: Date,
  end: Date,
  lessons: Lesson[],
  excludeLessonId?: string
) {
  return !lessons.some((l) => {
    if (l.teacherId !== teacherId) return false;
    if (l.status === "cancelled") return false;
    if (excludeLessonId && l.id === excludeLessonId) return false;
    return overlaps(start, end, parseISO(l.startAt), parseISO(l.endAt));
  });
}

function roomFree(
  roomId: string,
  start: Date,
  end: Date,
  lessons: Lesson[],
  excludeLessonId?: string
) {
  return !lessons.some((l) => {
    if (l.roomId !== roomId) return false;
    if (l.status === "cancelled") return false;
    if (excludeLessonId && l.id === excludeLessonId) return false;
    return overlaps(start, end, parseISO(l.startAt), parseISO(l.endAt));
  });
}

function teacherAvailableOnDay(teacher: Teacher, day: Date, start: Date, end: Date) {
  const dow = getDay(day);
  const windows = teacher.availability.filter((a) => a.dayOfWeek === dow);
  if (!windows.length) return false;
  return windows.some((w) => {
    const { h: sh, m: sm } = parseHm(w.start);
    const { h: eh, m: em } = parseHm(w.end);
    const winStart = setMinutes(setHours(startOfDay(day), sh), sm);
    const winEnd = setMinutes(setHours(startOfDay(day), eh), em);
    return !isBefore(start, winStart) && !isAfter(end, winEnd);
  });
}

function dailyLessonCount(teacherId: string, day: Date, lessons: Lesson[]) {
  return lessons.filter((l) => {
    if (l.teacherId !== teacherId || l.status === "cancelled") return false;
    return format(parseISO(l.startAt), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
  }).length;
}

/**
 * Telafi slot motoru:
 * - Aynı öğretmen + enstrüman tercihi
 * - Müsaitlik, oda, çakışma kontrolü
 * - Skor: öğretmen uyumu, yakınlık, yoğunluk, okul kaynaklı öncelik
 */
export function suggestMakeupSlots(
  data: AppData,
  request: MakeupRequest,
  options?: { maxSlots?: number; daysAhead?: number }
): MakeupSlot[] {
  const maxSlots = options?.maxSlots ?? 6;
  const daysAhead = options?.daysAhead ?? data.settings.makeupWindowDays;
  const duration = data.settings.lessonDurationMinutes;
  const { workingHours, workingDays } = data.settings;
  const { h: whStartH, m: whStartM } = parseHm(workingHours.start);
  const { h: whEndH, m: whEndM } = parseHm(workingHours.end);

  const candidates = data.teachers.filter(
    (t) =>
      t.active &&
      t.instruments.includes(request.instrument as Teacher["instruments"][number])
  );

  // Aynı öğretmen + aynı şube öne
  candidates.sort((a, b) => {
    if (a.id === request.teacherId) return -1;
    if (b.id === request.teacherId) return 1;
    if (a.branchId === request.branchId && b.branchId !== request.branchId) return -1;
    if (b.branchId === request.branchId && a.branchId !== request.branchId) return 1;
    return 0;
  });

  const rooms = data.rooms.filter(
    (r) => roomSupports(r, request.instrument) && r.branchId === request.branchId
  );
  // Aynı şubede oda yoksa diğer şubeye düş
  const roomsFallback =
    rooms.length > 0
      ? rooms
      : data.rooms.filter((r) => roomSupports(r, request.instrument));
  const slots: MakeupSlot[] = [];
  const now = new Date();
  const expire = parseISO(request.expiresAt);

  for (let d = 1; d <= daysAhead; d++) {
    const day = addDays(startOfDay(now), d);
    if (isAfter(day, expire)) break;
    const dow = getDay(day);
    if (!workingDays.includes(dow)) continue;

    const dayStart = setMinutes(setHours(day, whStartH), whStartM);
    const dayEnd = setMinutes(setHours(day, whEndH), whEndM);

    for (let cursor = new Date(dayStart); cursor < dayEnd; cursor = addMinutes(cursor, 30)) {
      const slotEnd = addMinutes(cursor, duration);
      if (slotEnd > dayEnd) break;
      if (isBefore(cursor, now)) continue;

      for (const teacher of candidates) {
        if (!teacherAvailableOnDay(teacher, day, cursor, slotEnd)) continue;
        if (!teacherFree(teacher.id, cursor, slotEnd, data.lessons)) continue;
        if (dailyLessonCount(teacher.id, day, data.lessons) >= teacher.maxDailyLessons) continue;

        // Öğretmen ile oda aynı şubede olmalı
        const teacherRooms = roomsFallback.filter((r) => r.branchId === teacher.branchId);
        const freeRoom = teacherRooms.find((r) => roomFree(r.id, cursor, slotEnd, data.lessons));
        if (!freeRoom) continue;

        const reasons: string[] = [];
        let score = 50;

        if (teacher.id === request.teacherId) {
          score += 30;
          reasons.push("Aynı öğretmen");
        } else {
          score += 5;
          reasons.push("Alternatif öğretmen (aynı enstrüman)");
        }

        if (teacher.branchId === request.branchId) {
          score += 15;
          reasons.push("Aynı şube");
        } else {
          score -= 10;
          reasons.push("Diğer şube");
        }

        // Yakınlık: daha erken slot biraz daha yüksek skor
        score += Math.max(0, 20 - d);
        reasons.push(`${d} gün içinde`);

        const load = dailyLessonCount(teacher.id, day, data.lessons);
        if (load <= 2) {
          score += 10;
          reasons.push("Öğretmen programı rahat");
        } else if (load >= 5) {
          score -= 8;
          reasons.push("Yoğun gün");
        }

        // Okul kaynaklı iptaller öncelikli
        if (request.reason.toLowerCase().includes("öğretmen") || request.reason.toLowerCase().includes("okul")) {
          score += 8;
          reasons.push("Okul kaynaklı — öncelikli");
        }

        // Öğrencinin mevcut ders saatiyle çakışma
        const studentBusy = data.lessons.some((l) => {
          if (l.studentId !== request.studentId || l.status === "cancelled") return false;
          return overlaps(cursor, slotEnd, parseISO(l.startAt), parseISO(l.endAt));
        });
        if (studentBusy) continue;

        slots.push({
          startAt: cursor.toISOString(),
          endAt: slotEnd.toISOString(),
          teacherId: teacher.id,
          roomId: freeRoom.id,
          branchId: freeRoom.branchId,
          score,
          reasons,
        });
      }
    }
  }

  // Skora göre sırala, aynı saatte tek öneri
  slots.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const unique: MakeupSlot[] = [];
  for (const s of slots) {
    const key = `${s.startAt}|${s.teacherId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
    if (unique.length >= maxSlots) break;
  }
  return unique;
}

export function confirmMakeupSlot(
  data: AppData,
  requestId: string,
  slot: MakeupSlot
): { data: AppData; lessonId: string } {
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");
  if (request.status !== "pending" && request.status !== "suggested") {
    throw new Error("Bu telafi talebi zaten sonuçlandırılmış");
  }

  const lessonId = `l_mk_${Date.now().toString(36)}`;
  const lesson: Lesson = {
    id: lessonId,
    studentId: request.studentId,
    teacherId: slot.teacherId,
    roomId: slot.roomId,
    branchId: slot.branchId,
    instrument: request.instrument,
    startAt: slot.startAt,
    endAt: slot.endAt,
    type: "makeup",
    status: "scheduled",
    makeupRequestId: requestId,
    notes: `Telafi · kaynak ders ${request.sourceLessonId}`,
  };

  const makeupRequests = data.makeupRequests.map((m) =>
    m.id === requestId
      ? {
          ...m,
          status: "confirmed" as const,
          suggestedSlots: m.suggestedSlots,
          confirmedLessonId: lessonId,
        }
      : m
  );

  return {
    data: {
      ...data,
      lessons: [...data.lessons, lesson],
      makeupRequests,
    },
    lessonId,
  };
}
