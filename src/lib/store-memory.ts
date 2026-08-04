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
  Branch,
  FeeRoundingMode,
  Instrument,
  Lesson,
  MakeupRequest,
  MakeupSlot,
  Payment,
  Room,
  Student,
  Teacher,
  TeacherFeeRule,
} from "./types";
import { suggestMakeupSlots, confirmMakeupSlot, validateLessonSlot } from "./makeup-engine";
import { applyLessonScheduleUpdate, applyLessonCancel } from "./lesson-update";
import {
  createLessonSeriesData,
  cancelSeriesFromLesson,
  cancelEntireSeries,
  type SeriesParams,
  type CreateSeriesResult,
  type SeriesCancelResult,
} from "./lesson-series";
import {
  createTeacherFeeRuleData,
  updateTeacherFeeRuleData,
  createTeacherPayoutSnapshot,
  markTeacherPayoutPaidData,
  type FeeRuleInput,
  type FeeRuleMutationResult,
  type CreateTeacherPayoutResult,
  type MarkPayoutPaidResult,
} from "./teacher-payout";
import type { BranchImportRow } from "./import/branches";
import type { TeacherImportRow } from "./import/teachers";
import type { RoomImportRow } from "./import/rooms";
import type { StudentImportRow } from "./import/students";
import type { ImportCommitResult } from "./import/commit-result";
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

function assertBranchExists(data: AppData, branchId: string) {
  if (!data.settings.branches.some((b) => b.id === branchId)) {
    throw new Error("Şube bulunamadı");
  }
}

export async function addBranch(branch: Omit<Branch, "id">): Promise<AppData> {
  const data = load();
  const b: Branch = { ...branch, id: uid("branch") };
  return save({
    ...data,
    settings: { ...data.settings, branches: [...data.settings.branches, b] },
  });
}

export async function updateBranch(
  branchId: string,
  patch: Partial<Omit<Branch, "id">>
): Promise<AppData> {
  const data = load();
  assertBranchExists(data, branchId);
  const branches = data.settings.branches.map((b) => (b.id === branchId ? { ...b, ...patch } : b));
  return save({ ...data, settings: { ...data.settings, branches } });
}

export async function addStudent(
  student: Omit<Student, "id" | "createdAt" | "active">
): Promise<AppData> {
  const data = load();
  assertBranchExists(data, student.branchId);
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
  assertBranchExists(data, teacher.branchId);
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
  assertBranchExists(data, room.branchId);
  const r: Room = { ...room, id: uid("room") };
  return save({ ...data, rooms: [...data.rooms, r] });
}

export async function addLesson(input: {
  studentId: string;
  teacherId: string;
  roomId: string;
  instrument: Instrument;
  startAt: string;
}): Promise<AppData> {
  const data = load();
  const validation = validateLessonSlot(
    data,
    { instrument: input.instrument, studentId: input.studentId },
    { teacherId: input.teacherId, roomId: input.roomId, startAt: input.startAt }
  );
  if (!validation.ok) throw new Error(validation.message);
  const slot = validation.slot;
  const lesson: Lesson = {
    id: uid("les"),
    studentId: input.studentId,
    teacherId: slot.teacherId,
    roomId: slot.roomId,
    branchId: slot.branchId,
    instrument: input.instrument,
    startAt: slot.startAt,
    endAt: slot.endAt,
    type: "regular",
    status: "scheduled",
  };
  return save({ ...data, lessons: [...data.lessons, lesson] });
}

export async function updateLessonSchedule(input: {
  lessonId: string;
  startAt?: string;
  durationMinutes?: number;
}): Promise<AppData> {
  const data = load();
  const result = applyLessonScheduleUpdate(data, input);
  if (!result.ok) throw new Error(result.message);
  return save(result.data);
}

export async function cancelLesson(lessonId: string): Promise<AppData> {
  const data = load();
  const result = applyLessonCancel(data, lessonId);
  if (!result.ok) throw new Error(result.message);
  return save(result.data);
}

function assertLessonSeriesRefsExist(data: AppData, params: SeriesParams) {
  if (!data.students.some((s) => s.id === params.studentId)) throw new Error("Öğrenci bulunamadı");
  if (!data.teachers.some((t) => t.id === params.teacherId)) throw new Error("Öğretmen bulunamadı");
  if (!data.rooms.some((r) => r.id === params.roomId)) throw new Error("Oda bulunamadı");
  if (!data.settings.branches.some((b) => b.id === params.branchId)) throw new Error("Şube bulunamadı");
}

export async function addLessonSeries(
  params: SeriesParams,
  options?: { skipConflicts?: boolean }
): Promise<CreateSeriesResult> {
  const data = load();
  assertLessonSeriesRefsExist(data, params);
  const result = createLessonSeriesData(data, params, options);
  if (result.ok) save(result.data);
  return result;
}

export async function cancelLessonSeriesFromLesson(lessonId: string): Promise<SeriesCancelResult> {
  const data = load();
  const result = cancelSeriesFromLesson(data, lessonId);
  if (result.ok) save(result.data);
  return result;
}

export async function cancelEntireLessonSeries(seriesId: string): Promise<SeriesCancelResult> {
  const data = load();
  const result = cancelEntireSeries(data, seriesId);
  if (result.ok) save(result.data);
  return result;
}

function assertTeacherExists(data: AppData, teacherId: string) {
  if (!data.teachers.some((t) => t.id === teacherId)) throw new Error("Öğretmen bulunamadı");
}

export async function addTeacherFeeRule(input: FeeRuleInput): Promise<FeeRuleMutationResult> {
  const data = load();
  assertTeacherExists(data, input.teacherId);
  const result = createTeacherFeeRuleData(data, input);
  if (result.ok) save(result.data);
  return result;
}

export async function updateTeacherFeeRule(
  ruleId: string,
  patch: Partial<Omit<TeacherFeeRule, "id" | "createdAt">>
): Promise<FeeRuleMutationResult> {
  const data = load();
  const result = updateTeacherFeeRuleData(data, ruleId, patch);
  if (result.ok) save(result.data);
  return result;
}

export async function createTeacherPayout(
  teacherId: string,
  periodStart: string,
  periodEnd: string
): Promise<CreateTeacherPayoutResult> {
  const data = load();
  assertTeacherExists(data, teacherId);
  const result = createTeacherPayoutSnapshot(data, teacherId, periodStart, periodEnd);
  if (result.ok) save(result.data);
  return result;
}

export async function markTeacherPayoutPaid(
  payoutId: string,
  method?: string
): Promise<MarkPayoutPaidResult> {
  const data = load();
  const result = markTeacherPayoutPaidData(data, payoutId, method);
  if (result.ok) save(result.data);
  return result;
}

export async function updateFeeRoundingMode(feeRoundingMode: FeeRoundingMode): Promise<AppData> {
  const data = load();
  return save({ ...data, settings: { ...data.settings, feeRoundingMode } });
}

const TEACHER_COLORS = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#059669", "#4f46e5"];

export async function importBranches(rows: BranchImportRow[]): Promise<ImportCommitResult> {
  const data = load();
  const branches = [...data.settings.branches];
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const idx = branches.findIndex((b) => b.shortName.trim().toLowerCase() === row.shortName.trim().toLowerCase());
    if (idx >= 0) {
      branches[idx] = { ...branches[idx], ...row };
      updated++;
    } else {
      branches.push({ ...row, id: uid("branch") });
      created++;
    }
  }
  const next = save({ ...data, settings: { ...data.settings, branches } });
  return { data: next, created, updated };
}

export async function importTeachers(rows: TeacherImportRow[]): Promise<ImportCommitResult> {
  const data = load();
  const teachers = [...data.teachers];
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const idx = teachers.findIndex((t) => t.email.trim().toLowerCase() === row.email.trim().toLowerCase());
    if (idx >= 0) {
      teachers[idx] = {
        ...teachers[idx],
        name: row.name,
        phone: row.phone,
        branchId: row.branchId,
        instruments: [row.instrument],
      };
      updated++;
    } else {
      teachers.push({
        id: uid("tch"),
        name: row.name,
        email: row.email,
        phone: row.phone,
        branchId: row.branchId,
        instruments: [row.instrument],
        availability: [
          { dayOfWeek: 1, start: "10:00", end: "18:00" },
          { dayOfWeek: 2, start: "10:00", end: "18:00" },
          { dayOfWeek: 3, start: "10:00", end: "18:00" },
          { dayOfWeek: 4, start: "10:00", end: "18:00" },
          { dayOfWeek: 5, start: "10:00", end: "16:00" },
        ],
        maxDailyLessons: 8,
        active: true,
        color: TEACHER_COLORS[teachers.length % TEACHER_COLORS.length],
      });
      created++;
    }
  }
  const next = save({ ...data, teachers });
  return { data: next, created, updated };
}

export async function importRooms(rows: RoomImportRow[]): Promise<ImportCommitResult> {
  const data = load();
  const rooms = [...data.rooms];
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const idx = rooms.findIndex(
      (r) => r.branchId === row.branchId && r.name.trim().toLowerCase() === row.name.trim().toLowerCase()
    );
    if (idx >= 0) {
      rooms[idx] = { ...rooms[idx], capacity: row.capacity, instruments: row.instruments };
      updated++;
    } else {
      rooms.push({ id: uid("room"), name: row.name, branchId: row.branchId, capacity: row.capacity, instruments: row.instruments });
      created++;
    }
  }
  const next = save({ ...data, rooms });
  return { data: next, created, updated };
}

export async function importStudents(rows: StudentImportRow[]): Promise<ImportCommitResult> {
  const data = load();
  const students = [...data.students];
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const idx = students.findIndex((s) => s.phone.trim() === row.phone.trim());
    if (idx >= 0) {
      students[idx] = {
        ...students[idx],
        name: row.name,
        email: row.email || students[idx].email,
        parentName: row.parentName,
        parentPhone: row.parentPhone,
        branchId: row.branchId,
        instruments: [row.instrument],
        teacherId: row.teacherId,
        packageName: row.packageName,
        weeklyLessonCount: row.weeklyLessonCount,
        monthlyFee: row.monthlyFee,
        notes: row.notes || students[idx].notes,
      };
      updated++;
    } else {
      students.push({
        id: uid("stu"),
        name: row.name,
        email: row.email,
        phone: row.phone,
        parentName: row.parentName,
        parentPhone: row.parentPhone,
        branchId: row.branchId,
        instruments: [row.instrument],
        teacherId: row.teacherId,
        packageName: row.packageName,
        weeklyLessonCount: row.weeklyLessonCount,
        monthlyFee: row.monthlyFee,
        active: true,
        notes: row.notes,
        createdAt: new Date().toISOString(),
      });
      created++;
    }
  }
  const next = save({ ...data, students });
  return { data: next, created, updated };
}

export async function addPayment(input: {
  studentId: string;
  description: string;
  amount: number;
  dueDate: string;
}): Promise<AppData> {
  const data = load();
  const isOverdue = new Date(input.dueDate).getTime() < Date.now();
  const payment: Payment = {
    id: uid("pay"),
    studentId: input.studentId,
    amount: input.amount,
    paidAmount: 0,
    status: isOverdue ? "overdue" : "pending",
    dueDate: input.dueDate,
    description: input.description,
  };
  return save({ ...data, payments: [...data.payments, payment] });
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
