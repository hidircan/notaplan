import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
});

export const updateBranchSchema = branchSchema.partial().extend({
  branchId: z.string().min(1),
});

export const attendanceSchema = z.object({
  lessonId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "cancelled_by_school"]),
  reason: z.string().optional(),
});

const optionalEmail = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v : undefined))
  .pipe(z.string().email().optional());

export const studentSchema = z.object({
  name: z.string().min(1),
  email: optionalEmail,
  phone: z.string().min(1),
  parentName: z.string().min(1),
  parentPhone: z.string().min(1),
  branchId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  teacherId: z.string().min(1),
  packageName: z.string().min(1),
  weeklyLessonCount: z.coerce.number().int().min(1),
  monthlyFee: z.coerce.number().int().min(0),
  notes: z.string().optional(),
});

export const teacherSchema = z.object({
  name: z.string().min(1),
  email: optionalEmail,
  phone: z.string().min(1),
  branchId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
});

export const roomSchema = z.object({
  name: z.string().min(1),
  branchId: z.string().min(1),
  capacity: z.coerce.number().int().min(1),
  instruments: z
    .array(z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]))
    .min(1),
});

export const lessonSchema = z.object({
  studentId: z.string().min(1),
  teacherId: z.string().min(1),
  roomId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  startAt: z.string().min(1),
});

export const paymentRecordSchema = z.object({
  studentId: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().int().min(1),
  dueDate: z.string().min(1),
});

export const updateLessonScheduleSchema = z
  .object({
    lessonId: z.string().min(1),
    startAt: z.string().min(1).optional(),
    durationMinutes: z.coerce.number().int().min(30).max(240).optional(),
  })
  .refine((d) => d.startAt !== undefined || d.durationMinutes !== undefined, {
    message: "startAt veya durationMinutes gerekli",
  });

export const cancelLessonSchema = z.object({
  lessonId: z.string().min(1),
});

export const suggestLessonSlotsSchema = z.object({
  studentId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  teacherId: z.string().min(1).optional(),
  daysAhead: z.coerce.number().int().positive().max(60).optional(),
  maxSlots: z.coerce.number().int().positive().max(50).optional(),
});

export const lessonSeriesParamsSchema = z.object({
  studentId: z.string().min(1),
  teacherId: z.string().min(1),
  roomId: z.string().min(1),
  branchId: z.string().min(1),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat HH:mm biçiminde olmalı"),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  startsOn: z.string().min(1),
  endsOn: z.string().min(1),
});

export const createLessonSeriesSchema = lessonSeriesParamsSchema.extend({
  skipConflicts: z.coerce.boolean().optional(),
});

export const cancelSeriesFromLessonSchema = z.object({
  lessonId: z.string().min(1),
});

export const cancelEntireSeriesSchema = z.object({
  seriesId: z.string().min(1),
});

export const makeupSlotSchema = z.object({
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  teacherId: z.string().min(1),
  roomId: z.string().min(1),
  branchId: z.string().min(1),
  score: z.number(),
  reasons: z.array(z.string()),
});
