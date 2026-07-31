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
  BranchId,
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

export type SlotValidationCode =
  | "REQUEST_NOT_OPEN"
  | "INVALID_START"
  | "PAST_START"
  | "AFTER_EXPIRY"
  | "OUTSIDE_WORKING_DAY"
  | "OUTSIDE_WORKING_HOURS"
  | "TEACHER_NOT_FOUND"
  | "TEACHER_INACTIVE"
  | "TEACHER_INSTRUMENT_MISMATCH"
  | "TEACHER_UNAVAILABLE"
  | "TEACHER_CONFLICT"
  | "TEACHER_DAILY_LIMIT"
  | "ROOM_NOT_FOUND"
  | "ROOM_INSTRUMENT_MISMATCH"
  | "ROOM_BRANCH_MISMATCH"
  | "ROOM_CONFLICT"
  | "STUDENT_CONFLICT";

export const SLOT_ERROR_MESSAGES: Record<SlotValidationCode, string> = {
  REQUEST_NOT_OPEN: "Bu telafi talebi zaten sonuçlandırılmış.",
  INVALID_START: "Geçerli bir tarih ve saat seçin.",
  PAST_START: "Başlangıç saati geçmişte olamaz.",
  AFTER_EXPIRY: "Ders, telafi son kullanım tarihini aşıyor.",
  OUTSIDE_WORKING_DAY: "Seçilen gün okulun çalışma günleri dışında.",
  OUTSIDE_WORKING_HOURS: "Seçilen saat okulun çalışma saatleri dışında.",
  TEACHER_NOT_FOUND: "Seçilen öğretmen bulunamadı.",
  TEACHER_INACTIVE: "Seçilen öğretmen aktif değil.",
  TEACHER_INSTRUMENT_MISMATCH: "Seçilen öğretmen bu enstrümanı vermiyor.",
  TEACHER_UNAVAILABLE: "Öğretmen bu saatte müsait değil.",
  TEACHER_CONFLICT: "Öğretmenin bu saatte başka bir dersi var.",
  TEACHER_DAILY_LIMIT: "Öğretmenin günlük ders limiti doldu.",
  ROOM_NOT_FOUND: "Seçilen oda bulunamadı.",
  ROOM_INSTRUMENT_MISMATCH: "Seçilen oda bu enstrümana uygun değil.",
  ROOM_BRANCH_MISMATCH: "Oda, öğretmenin şubesiyle uyumsuz.",
  ROOM_CONFLICT: "Odanın bu saatte başka bir dersi var.",
  STUDENT_CONFLICT: "Öğrencinin bu saatte başka bir dersi var.",
};

export type ValidatedSlot = {
  startAt: string;
  endAt: string;
  teacherId: string;
  roomId: string;
  branchId: BranchId;
};

type SlotValidationResult =
  | { ok: true; slot: ValidatedSlot }
  | { ok: false; code: SlotValidationCode; message: string };

/**
 * Tek doğrulama kaynağı — hem öneri motoru hem manuel telafi planlama
 * bu fonksiyonu kullanır. Bitiş saati her zaman burada, okul ders süresine
 * göre yeniden hesaplanır; çağıranın gönderdiği bitiş saatine güvenilmez.
 */
export function validateMakeupSlot(
  data: AppData,
  request: MakeupRequest,
  input: { teacherId: string; roomId: string; startAt: string },
  options?: { excludeLessonId?: string; now?: Date }
): SlotValidationResult {
  const fail = (code: SlotValidationCode): SlotValidationResult => ({
    ok: false,
    code,
    message: SLOT_ERROR_MESSAGES[code],
  });

  if (request.status !== "pending" && request.status !== "suggested") {
    return fail("REQUEST_NOT_OPEN");
  }

  const start = parseISO(input.startAt);
  if (Number.isNaN(start.getTime())) return fail("INVALID_START");

  const now = options?.now ?? new Date();
  if (start < now) return fail("PAST_START");

  const duration = data.settings.lessonDurationMinutes;
  const end = addMinutes(start, duration);

  const expire = parseISO(request.expiresAt);
  if (end > expire) return fail("AFTER_EXPIRY");

  const day = startOfDay(start);
  if (!data.settings.workingDays.includes(getDay(day))) return fail("OUTSIDE_WORKING_DAY");

  const { h: whStartH, m: whStartM } = parseHm(data.settings.workingHours.start);
  const { h: whEndH, m: whEndM } = parseHm(data.settings.workingHours.end);
  const dayStart = setMinutes(setHours(day, whStartH), whStartM);
  const dayEnd = setMinutes(setHours(day, whEndH), whEndM);
  if (start < dayStart || end > dayEnd) return fail("OUTSIDE_WORKING_HOURS");

  const teacher = data.teachers.find((t) => t.id === input.teacherId);
  if (!teacher) return fail("TEACHER_NOT_FOUND");
  if (!teacher.active) return fail("TEACHER_INACTIVE");
  if (!teacher.instruments.includes(request.instrument as Teacher["instruments"][number])) {
    return fail("TEACHER_INSTRUMENT_MISMATCH");
  }
  if (!teacherAvailableOnDay(teacher, day, start, end)) return fail("TEACHER_UNAVAILABLE");
  if (!teacherFree(teacher.id, start, end, data.lessons, options?.excludeLessonId)) {
    return fail("TEACHER_CONFLICT");
  }
  if (dailyLessonCount(teacher.id, day, data.lessons) >= teacher.maxDailyLessons) {
    return fail("TEACHER_DAILY_LIMIT");
  }

  const room = data.rooms.find((r) => r.id === input.roomId);
  if (!room) return fail("ROOM_NOT_FOUND");
  if (!roomSupports(room, request.instrument)) return fail("ROOM_INSTRUMENT_MISMATCH");
  if (room.branchId !== teacher.branchId) return fail("ROOM_BRANCH_MISMATCH");
  if (!roomFree(room.id, start, end, data.lessons, options?.excludeLessonId)) {
    return fail("ROOM_CONFLICT");
  }

  const studentBusy = data.lessons.some((l) => {
    if (options?.excludeLessonId && l.id === options.excludeLessonId) return false;
    if (l.studentId !== request.studentId || l.status === "cancelled") return false;
    return overlaps(start, end, parseISO(l.startAt), parseISO(l.endAt));
  });
  if (studentBusy) return fail("STUDENT_CONFLICT");

  return {
    ok: true,
    slot: {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      teacherId: teacher.id,
      roomId: room.id,
      branchId: room.branchId,
    },
  };
}

/**
 * Telafi slot motoru:
 * - Aynı öğretmen + enstrüman tercihi
 * - Uygunluk/çakışma kontrolü validateMakeupSlot() ile tek kaynaktan yapılır
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
      const slotEndPreview = addMinutes(cursor, duration);
      if (slotEndPreview > dayEnd) break;
      if (isBefore(cursor, now)) continue;

      for (const teacher of candidates) {
        const teacherRooms = roomsFallback.filter((r) => r.branchId === teacher.branchId);
        let matched: ValidatedSlot | null = null;
        for (const room of teacherRooms) {
          const result = validateMakeupSlot(data, request, {
            teacherId: teacher.id,
            roomId: room.id,
            startAt: cursor.toISOString(),
          });
          if (result.ok) {
            matched = result.slot;
            break;
          }
        }
        if (!matched) continue;

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

        slots.push({ ...matched, score, reasons });
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
  input: { teacherId: string; roomId: string; startAt: string }
): { data: AppData; lessonId: string; slot: ValidatedSlot } {
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");

  const validation = validateMakeupSlot(data, request, input);
  if (!validation.ok) throw new Error(validation.message);
  const slot = validation.slot;

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
    slot,
  };
}
