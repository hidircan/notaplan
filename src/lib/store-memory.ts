/**
 * Serverless / demo memory store.
 * Process warm olduğu sürece veri kalır; cold start'ta seed yeniden yüklenir.
 */
import { createSeedData } from "./seed";
import { tryTenantId } from "./tenant-context";
import { DEFAULT_TENANT_ID } from "./auth/config";
import type {
  AppData,
  Attendance,
  AttendanceStatus,
  MakeupRequest,
  MakeupSlot,
  Payment,
  Room,
  Student,
  Teacher,
} from "./types";
import { suggestMakeupSlots, confirmMakeupSlot } from "./makeup-engine";
import { uid } from "./utils";
import { addDays, formatISO } from "date-fns";

const g = globalThis as unknown as { __notaplanByTenant?: Record<string, AppData> };

function tenantKey(): string {
  return tryTenantId() ?? DEFAULT_TENANT_ID;
}

function load(): AppData {
  if (!g.__notaplanByTenant) g.__notaplanByTenant = {};
  const tid = tenantKey();
  if (!g.__notaplanByTenant[tid]) {
    const seed = createSeedData();
    seed.settings.tenantId = tid;
    g.__notaplanByTenant[tid] = seed;
  }
  const data = g.__notaplanByTenant[tid];
  if (data.settings.tenantId !== tid) {
    throw new Error("Cross-tenant access denied");
  }
  return data;
}

function save(data: AppData): AppData {
  const tid = tenantKey();
  if ((data.settings.tenantId || tid) !== tid) {
    throw new Error("Cross-tenant access denied");
  }
  data.settings.tenantId = tid;
  if (!g.__notaplanByTenant) g.__notaplanByTenant = {};
  g.__notaplanByTenant[tid] = data;
  return data;
}

export async function readData(): Promise<AppData> {
  return load();
}

export async function writeData(data: AppData): Promise<void> {
  save(data);
}

export async function resetData(): Promise<AppData> {
  return save(createSeedData());
}

export async function markAttendance(input: {
  lessonId: string;
  status: AttendanceStatus;
  reason?: string;
}): Promise<AppData> {
  const data = load();
  const lesson = data.lessons.find((l) => l.id === input.lessonId);
  if (!lesson) throw new Error("Ders bulunamadı");

  const createsMakeupCredit =
    input.status === "absent" || input.status === "cancelled_by_school";

  const attendance: Attendance = {
    id: uid("att"),
    lessonId: input.lessonId,
    studentId: lesson.studentId,
    status: input.status,
    reason: input.reason,
    markedAt: new Date().toISOString(),
    createsMakeupCredit,
  };

  const filtered = data.attendances.filter((a) => a.lessonId !== input.lessonId);

  let lessonStatus: typeof lesson.status = lesson.status;
  if (input.status === "present" || input.status === "late") lessonStatus = "completed";
  if (input.status === "absent") lessonStatus = "no_show";
  if (input.status === "cancelled_by_school") lessonStatus = "cancelled";

  const lessons = data.lessons.map((l) =>
    l.id === input.lessonId ? { ...l, status: lessonStatus } : l
  );

  let makeupRequests = data.makeupRequests.filter((m) => m.sourceLessonId !== input.lessonId);

  if (createsMakeupCredit) {
    const branch = data.settings.branches.find((b) => b.id === lesson.branchId);
    const req: MakeupRequest = {
      id: uid("mk"),
      studentId: lesson.studentId,
      teacherId: lesson.teacherId,
      branchId: lesson.branchId,
      instrument: lesson.instrument,
      sourceLessonId: lesson.id,
      attendanceId: attendance.id,
      status: "pending",
      reason: input.reason || (input.status === "cancelled_by_school" ? "Okul iptali" : "Devamsızlık"),
      expiresAt: formatISO(addDays(new Date(), data.settings.makeupWindowDays)),
      suggestedSlots: [],
      createdAt: new Date().toISOString(),
      policyNote:
        input.status === "cancelled_by_school"
          ? `Okul kaynaklı iptal — öncelikli yerleştirme · ${branch?.shortName ?? ""}`
          : `${data.settings.makeupWindowDays} gün içinde · aynı öğretmen · ${branch?.shortName ?? ""}`,
    };
    makeupRequests = [...makeupRequests, req];
  }

  return save({
    ...data,
    lessons,
    attendances: [...filtered, attendance],
    makeupRequests,
  });
}

export async function generateSuggestions(
  requestId: string,
  options?: { maxSlots?: number }
): Promise<AppData> {
  const data = load();
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");

  const slots = suggestMakeupSlots(data, request, options);
  const makeupRequests = data.makeupRequests.map((m) =>
    m.id === requestId
      ? { ...m, status: "suggested" as const, suggestedSlots: slots }
      : m
  );
  return save({ ...data, makeupRequests });
}

export async function confirmSlot(requestId: string, slot: MakeupSlot): Promise<AppData> {
  const data = load();
  const { data: next } = confirmMakeupSlot(data, requestId, slot);
  return save(next);
}

export async function cancelMakeup(requestId: string): Promise<AppData> {
  const data = load();
  const makeupRequests = data.makeupRequests.map((m) =>
    m.id === requestId ? { ...m, status: "cancelled" as const } : m
  );
  return save({ ...data, makeupRequests });
}

export async function addStudent(
  student: Omit<Student, "id" | "createdAt" | "active">
): Promise<AppData> {
  const data = load();
  const s: Student = {
    ...student,
    id: uid("stu"),
    active: true,
    createdAt: new Date().toISOString(),
  };
  return save({ ...data, students: [...data.students, s] });
}

export async function addTeacher(
  teacher: Omit<Teacher, "id" | "active" | "color">
): Promise<AppData> {
  const data = load();
  const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#059669", "#4f46e5"];
  const t: Teacher = {
    ...teacher,
    id: uid("tch"),
    active: true,
    color: colors[data.teachers.length % colors.length],
  };
  return save({ ...data, teachers: [...data.teachers, t] });
}

export async function markPaymentPaid(paymentId: string): Promise<AppData> {
  const data = load();
  const payments: Payment[] = data.payments.map((p) =>
    p.id === paymentId
      ? {
          ...p,
          status: "paid",
          paidAmount: p.amount,
          paidAt: new Date().toISOString(),
          method: p.method || "Havale",
        }
      : p
  );
  return save({ ...data, payments });
}

export async function addRoom(room: Omit<Room, "id">): Promise<AppData> {
  const data = load();
  const r: Room = { ...room, id: uid("room") };
  return save({ ...data, rooms: [...data.rooms, r] });
}

export function getDashboardStats(data: AppData) {
  const pendingMakeup = data.makeupRequests.filter(
    (m) => m.status === "pending" || m.status === "suggested"
  ).length;
  const confirmedMakeup = data.makeupRequests.filter((m) => m.status === "confirmed").length;
  const overduePayments = data.payments.filter((p) => p.status === "overdue" || p.status === "partial");
  const revenuePaid = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.paidAmount, 0);
  const revenueDue = data.payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayLessons = data.lessons.filter((l) => l.startAt.startsWith(today));
  const activeStudents = data.students.filter((s) => s.active).length;
  const activeTeachers = data.teachers.filter((t) => t.active).length;

  return {
    pendingMakeup,
    confirmedMakeup,
    overdueCount: overduePayments.length,
    revenuePaid,
    revenueDue,
    todayLessonCount: todayLessons.length,
    activeStudents,
    activeTeachers,
  };
}
