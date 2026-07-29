"use server";

import { revalidatePath } from "next/cache";
import type { BranchId, Instrument } from "./types";
import {
  cancelMakeup,
  confirmSlot,
  generateSuggestions,
  markAttendance,
  markPaymentPaid,
  resetData,
  addStudent,
  addTeacher,
} from "./store";
import { logger } from "./logger";
import {
  attendanceSchema,
  makeupSlotSchema,
  studentSchema,
  teacherSchema,
} from "./validation";

function revalidateAll() {
  revalidatePath("/", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel/ogretmenler");
  revalidatePath("/panel/program");
  revalidatePath("/panel/telafi");
  revalidatePath("/panel/odemeler");
  revalidatePath("/panel/yoklama");
  revalidatePath("/panel/bildirimler");
  revalidatePath("/veli");
  revalidatePath("/ogretmen");
}

export async function actionMarkAttendance(formData: FormData) {
  try {
    const input = attendanceSchema.parse({
      lessonId: String(formData.get("lessonId") || ""),
      status: String(formData.get("status") || ""),
      reason: String(formData.get("reason") || "") || undefined,
    });
    await markAttendance(input);
    revalidateAll();
  } catch (error) {
    logger.error("actionMarkAttendance failed", error);
    throw error;
  }
}

export async function actionGenerateSuggestions(formData: FormData) {
  try {
    const requestId = String(formData.get("requestId") || "");
    if (!requestId) throw new Error("Invalid requestId");
    await generateSuggestions(requestId);
    revalidateAll();
  } catch (error) {
    logger.error("actionGenerateSuggestions failed", error);
    throw error;
  }
}

export async function actionConfirmSlot(formData: FormData) {
  try {
    const requestId = String(formData.get("requestId") || "");
    if (!requestId) throw new Error("Invalid requestId");
    const slotJson = String(formData.get("slot") || "");
    const rawSlot = JSON.parse(slotJson);
    const slot = makeupSlotSchema.parse(rawSlot);
    await confirmSlot(requestId, slot);
    revalidateAll();
  } catch (error) {
    logger.error("actionConfirmSlot failed", error);
    throw error;
  }
}

export async function actionCancelMakeup(formData: FormData) {
  try {
    const requestId = String(formData.get("requestId") || "");
    if (!requestId) throw new Error("Invalid requestId");
    await cancelMakeup(requestId);
    revalidateAll();
  } catch (error) {
    logger.error("actionCancelMakeup failed", error);
    throw error;
  }
}

export async function actionMarkPaymentPaid(formData: FormData) {
  try {
    const paymentId = String(formData.get("paymentId") || "");
    if (!paymentId) throw new Error("Invalid paymentId");
    await markPaymentPaid(paymentId);
    revalidateAll();
  } catch (error) {
    logger.error("actionMarkPaymentPaid failed", error);
    throw error;
  }
}

export async function actionResetDemo() {
  try {
    await resetData();
    revalidateAll();
  } catch (error) {
    logger.error("actionResetDemo failed", error);
    throw error;
  }
}

export async function actionAddStudent(formData: FormData) {
  try {
    const parsed = studentSchema.parse({
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      parentName: String(formData.get("parentName") || ""),
      parentPhone: String(formData.get("parentPhone") || ""),
      branchId: String(formData.get("branchId") || "erzene"),
      instrument: String(formData.get("instrument") || "Piyano"),
      teacherId: String(formData.get("teacherId") || ""),
      packageName: String(formData.get("packageName") || "Bireysel Aylık — 4 ders"),
      weeklyLessonCount: Number(formData.get("weeklyLessonCount") || 1),
      monthlyFee: Number(formData.get("monthlyFee") || 3000),
      notes: String(formData.get("notes") || ""),
    });
    await addStudent({
      ...parsed,
      instruments: [parsed.instrument as Instrument],
      email: parsed.email ?? "",
      notes: parsed.notes ?? "",
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionAddStudent failed", error);
    throw error;
  }
}

export async function actionAddTeacher(formData: FormData) {
  try {
    const parsed = teacherSchema.parse({
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      branchId: String(formData.get("branchId") || "erzene"),
      instrument: String(formData.get("instrument") || "Piyano"),
    });
    await addTeacher({
      name: parsed.name,
      email: parsed.email ?? "",
      phone: parsed.phone,
      branchId: parsed.branchId as BranchId,
      instruments: [parsed.instrument as Instrument],
      availability: [
        { dayOfWeek: 1, start: "10:00", end: "18:00" },
        { dayOfWeek: 2, start: "10:00", end: "18:00" },
        { dayOfWeek: 3, start: "10:00", end: "18:00" },
        { dayOfWeek: 4, start: "10:00", end: "18:00" },
        { dayOfWeek: 5, start: "10:00", end: "16:00" },
      ],
      maxDailyLessons: 8,
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionAddTeacher failed", error);
    throw error;
  }
}
