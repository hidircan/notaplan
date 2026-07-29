import * as dbStore from "./store-db";
import type {
  AppData,
  AttendanceStatus,
  MakeupSlot,
  Student,
  Teacher,
} from "./types";

export async function readData(): Promise<AppData> {
  return dbStore.readData();
}

export async function resetData(): Promise<AppData> {
  return dbStore.resetData();
}

export async function markAttendance(input: {
  lessonId: string;
  status: AttendanceStatus;
  reason?: string;
}): Promise<AppData> {
  return dbStore.markAttendance(input);
}

export async function generateSuggestions(requestId: string): Promise<AppData> {
  return dbStore.generateSuggestions(requestId);
}

export async function confirmSlot(requestId: string, slot: MakeupSlot): Promise<AppData> {
  return dbStore.confirmSlot(requestId, slot);
}

export async function cancelMakeup(requestId: string): Promise<AppData> {
  return dbStore.cancelMakeup(requestId);
}

export async function addStudent(
  student: Omit<Student, "id" | "createdAt" | "active">
): Promise<AppData> {
  return dbStore.addStudent(student);
}

export async function addTeacher(
  teacher: Omit<Teacher, "id" | "active" | "color">
): Promise<AppData> {
  return dbStore.addTeacher(teacher);
}

export async function markPaymentPaid(paymentId: string): Promise<AppData> {
  return dbStore.markPaymentPaid(paymentId);
}

export function getDashboardStats(data: AppData) {
  return dbStore.getDashboardStats(data);
}
