"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus, BranchId, Instrument, MakeupSlot } from "./types";
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
  const lessonId = String(formData.get("lessonId") || "");
  const status = String(formData.get("status") || "") as AttendanceStatus;
  const reason = String(formData.get("reason") || "") || undefined;
  await markAttendance({ lessonId, status, reason });
  revalidateAll();
}

export async function actionGenerateSuggestions(formData: FormData) {
  const requestId = String(formData.get("requestId") || "");
  await generateSuggestions(requestId);
  revalidateAll();
}

export async function actionConfirmSlot(formData: FormData) {
  const requestId = String(formData.get("requestId") || "");
  const slotJson = String(formData.get("slot") || "");
  const slot = JSON.parse(slotJson) as MakeupSlot;
  await confirmSlot(requestId, slot);
  revalidateAll();
}

export async function actionCancelMakeup(formData: FormData) {
  const requestId = String(formData.get("requestId") || "");
  await cancelMakeup(requestId);
  revalidateAll();
}

export async function actionMarkPaymentPaid(formData: FormData) {
  const paymentId = String(formData.get("paymentId") || "");
  await markPaymentPaid(paymentId);
  revalidateAll();
}

export async function actionResetDemo() {
  await resetData();
  revalidateAll();
}

export async function actionAddStudent(formData: FormData) {
  await addStudent({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    parentName: String(formData.get("parentName") || ""),
    parentPhone: String(formData.get("parentPhone") || ""),
    branchId: String(formData.get("branchId") || "erzene") as BranchId,
    instruments: [String(formData.get("instrument") || "Piyano") as Instrument],
    teacherId: String(formData.get("teacherId") || ""),
    packageName: String(formData.get("packageName") || "Bireysel Aylık — 4 ders"),
    weeklyLessonCount: Number(formData.get("weeklyLessonCount") || 1),
    monthlyFee: Number(formData.get("monthlyFee") || 3000),
    notes: String(formData.get("notes") || ""),
  });
  revalidateAll();
}

export async function actionAddTeacher(formData: FormData) {
  const instrument = String(formData.get("instrument") || "Piyano") as Instrument;
  await addTeacher({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    branchId: String(formData.get("branchId") || "erzene") as BranchId,
    instruments: [instrument],
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
}
