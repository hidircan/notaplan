import { z } from "zod";

export const attendanceSchema = z.object({
  lessonId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "cancelled_by_school"]),
  reason: z.string().optional(),
});

export const studentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1),
  parentName: z.string().min(1),
  parentPhone: z.string().min(1),
  branchId: z.enum(["erzene", "evka3"]),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
  teacherId: z.string().min(1),
  packageName: z.string().min(1),
  weeklyLessonCount: z.coerce.number().int().min(1),
  monthlyFee: z.coerce.number().int().min(0),
  notes: z.string().optional(),
});

export const teacherSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1),
  branchId: z.enum(["erzene", "evka3"]),
  instrument: z.enum(["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]),
});

export const makeupSlotSchema = z.object({
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  teacherId: z.string().min(1),
  roomId: z.string().min(1),
  branchId: z.enum(["erzene", "evka3"]),
  score: z.number(),
  reasons: z.array(z.string()),
});
