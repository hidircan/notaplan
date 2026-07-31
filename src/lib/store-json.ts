import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "./config";
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
  Student,
  Teacher,
} from "./types";
import { suggestMakeupSlots, confirmMakeupSlot } from "./makeup-engine";
import { uid } from "./utils";
import { addDays, formatISO } from "date-fns";

const DATA_DIR = resolveDataDir(path.join(process.cwd(), "data"));
const DATA_FILE = path.join(DATA_DIR, "store.json");

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const seed = createSeedData();
    await fs.writeFile(DATA_FILE, JSON.stringify(seed, null, 2), "utf-8");
  }
}

function assertTenant(data: AppData) {
  const tid = tryTenantId() ?? DEFAULT_TENANT_ID;
  const dataTenant = data.settings.tenantId || DEFAULT_TENANT_ID;
  if (dataTenant !== tid) {
    throw new Error("Cross-tenant access denied");
  }
}

export async function readData(): Promise<AppData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as AppData;
  if (!data.settings.tenantId) data.settings.tenantId = DEFAULT_TENANT_ID;
  assertTenant(data);
  return data;
}

export async function writeData(data: AppData): Promise<void> {
  assertTenant(data);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function resetData(): Promise<AppData> {
  const seed = createSeedData();
  await writeData(seed);
  return seed;
}

export async function markAttendance(input: {
  lessonId: string;
  status: AttendanceStatus;
  reason?: string;
}): Promise<AppData> {
  const data = await readData();
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

  const next: AppData = {
    ...data,
    lessons,
    attendances: [...filtered, attendance],
    makeupRequests,
  };
  await writeData(next);
  return next;
}

export async function generateSuggestions(
  requestId: string,
  options?: { maxSlots?: number }
): Promise<AppData> {
  const data = await readData();
  const request = data.makeupRequests.find((m) => m.id === requestId);
  if (!request) throw new Error("Telafi talebi bulunamadı");

  const slots = suggestMakeupSlots(data, request, options);
  const makeupRequests = data.makeupRequests.map((m) =>
    m.id === requestId
      ? { ...m, status: "suggested" as const, suggestedSlots: slots }
      : m
  );
  const next = { ...data, makeupRequests };
  await writeData(next);
  return next;
}

export async function confirmSlot(requestId: string, slot: MakeupSlot): Promise<AppData> {
  const data = await readData();
  const { data: next } = confirmMakeupSlot(data, requestId, slot);
  await writeData(next);
  return next;
}

export async function cancelMakeup(requestId: string): Promise<AppData> {
  const data = await readData();
  const makeupRequests = data.makeupRequests.map((m) =>
    m.id === requestId ? { ...m, status: "cancelled" as const } : m
  );
  const next = { ...data, makeupRequests };
  await writeData(next);
  return next;
}

export async function addStudent(
  student: Omit<Student, "id" | "createdAt" | "active">
): Promise<AppData> {
  const data = await readData();
  const s: Student = {
    ...student,
    id: uid("stu"),
    active: true,
    createdAt: new Date().toISOString(),
  };
  const next = { ...data, students: [...data.students, s] };
  await writeData(next);
  return next;
}

export async function addTeacher(
  teacher: Omit<Teacher, "id" | "active" | "color">
): Promise<AppData> {
  const data = await readData();
  const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#059669", "#4f46e5"];
  const t: Teacher = {
    ...teacher,
    id: uid("tch"),
    active: true,
    color: colors[data.teachers.length % colors.length],
  };
  const next = { ...data, teachers: [...data.teachers, t] };
  await writeData(next);
  return next;
}

export async function markPaymentPaid(paymentId: string): Promise<AppData> {
  const data = await readData();
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
  const next = { ...data, payments };
  await writeData(next);
  return next;
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
