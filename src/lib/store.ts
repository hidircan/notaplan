import { STORE_MODE } from "./config";
import * as jsonStore from "./store-json";
import type {
  AppData,
  AttendanceStatus,
  Branch,
  Instrument,
  MakeupSlot,
  Room,
  Student,
  Teacher,
} from "./types";
import type { BranchImportRow } from "./import/branches";
import type { TeacherImportRow } from "./import/teachers";
import type { RoomImportRow } from "./import/rooms";
import type { StudentImportRow } from "./import/students";
import type { ImportCommitResult } from "./import/commit-result";
import type { CreateSeriesResult, SeriesCancelResult, SeriesParams } from "./lesson-series";

type StoreApi = {
  readData: () => Promise<AppData>;
  resetData: () => Promise<AppData>;
  markAttendance: (input: {
    lessonId: string;
    status: AttendanceStatus;
    reason?: string;
  }) => Promise<AppData>;
  generateSuggestions: (requestId: string, options?: { maxSlots?: number }) => Promise<AppData>;
  confirmSlot: (requestId: string, slot: MakeupSlot) => Promise<AppData>;
  cancelMakeup: (requestId: string) => Promise<AppData>;
  addStudent: (student: Omit<Student, "id" | "createdAt" | "active">) => Promise<AppData>;
  addTeacher: (teacher: Omit<Teacher, "id" | "active" | "color">) => Promise<AppData>;
  markPaymentPaid: (paymentId: string) => Promise<AppData>;
  addRoom: (room: Omit<Room, "id">) => Promise<AppData>;
  addLesson: (input: {
    studentId: string;
    teacherId: string;
    roomId: string;
    instrument: Instrument;
    startAt: string;
  }) => Promise<AppData>;
  addPayment: (input: {
    studentId: string;
    description: string;
    amount: number;
    dueDate: string;
  }) => Promise<AppData>;
  updateLessonSchedule: (input: {
    lessonId: string;
    startAt?: string;
    durationMinutes?: number;
  }) => Promise<AppData>;
  cancelLesson: (lessonId: string) => Promise<AppData>;
  addBranch: (branch: Omit<Branch, "id">) => Promise<AppData>;
  updateBranch: (branchId: string, patch: Partial<Omit<Branch, "id">>) => Promise<AppData>;
  importBranches: (rows: BranchImportRow[]) => Promise<ImportCommitResult>;
  importTeachers: (rows: TeacherImportRow[]) => Promise<ImportCommitResult>;
  importRooms: (rows: RoomImportRow[]) => Promise<ImportCommitResult>;
  importStudents: (rows: StudentImportRow[]) => Promise<ImportCommitResult>;
  addLessonSeries: (
    params: SeriesParams,
    options?: { skipConflicts?: boolean }
  ) => Promise<CreateSeriesResult>;
  cancelLessonSeriesFromLesson: (lessonId: string) => Promise<SeriesCancelResult>;
  cancelEntireLessonSeries: (seriesId: string) => Promise<SeriesCancelResult>;
  getDashboardStats: (data: AppData) => ReturnType<typeof jsonStore.getDashboardStats>;
};

function getStore(): StoreApi {
  if (STORE_MODE === "db") {
    // Lazy require: json deploy'da Prisma adapter yüklenmesin
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./store-db") as StoreApi;
  }
  if (STORE_MODE === "memory") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./store-memory") as StoreApi;
  }
  return jsonStore;
}

const store = getStore();

/** Bind tenant from ALS or authenticated web session */
async function withTenantScope<T>(fn: () => Promise<T>): Promise<T> {
  const { tryTenantId, runWithTenantAsync } = await import("./tenant-context");
  if (tryTenantId()) return fn();

  try {
    const { getSessionContext } = await import("./auth/session");
    const session = await getSessionContext();
    if (session?.tenantId) {
      return runWithTenantAsync(session.tenantId, fn);
    }
  } catch {
    // no session (public / build)
  }

  const { DEFAULT_TENANT_ID } = await import("./auth/config");
  return runWithTenantAsync(DEFAULT_TENANT_ID, fn);
}

export async function readData(): Promise<AppData> {
  const data = await withTenantScope(() => store.readData());
  return applyMakeupExpiry(data);
}

/**
 * Süresi geçmiş (expiresAt < şimdi) ama hâlâ pending/suggested olan telafi
 * taleplerini "expired" olarak gösterir. Salt okunur türetme — kalıcı kaydı
 * değiştirmez, dashboard ve Telafi Merkezi'nin süresi dolmuş talepleri açık
 * talep gibi saymasını engeller.
 */
function applyMakeupExpiry(data: AppData): AppData {
  const now = Date.now();
  const makeupRequests = data.makeupRequests.map((m) =>
    (m.status === "pending" || m.status === "suggested") &&
    new Date(m.expiresAt).getTime() < now
      ? { ...m, status: "expired" as const }
      : m
  );
  return { ...data, makeupRequests };
}

export async function resetData(): Promise<AppData> {
  return withTenantScope(() => store.resetData());
}

export async function markAttendance(input: {
  lessonId: string;
  status: AttendanceStatus;
  reason?: string;
}): Promise<AppData> {
  return withTenantScope(() => store.markAttendance(input));
}

export async function generateSuggestions(
  requestId: string,
  options?: { maxSlots?: number }
): Promise<AppData> {
  return withTenantScope(() => store.generateSuggestions(requestId, options));
}

export async function confirmSlot(requestId: string, slot: MakeupSlot): Promise<AppData> {
  return withTenantScope(() => store.confirmSlot(requestId, slot));
}

export async function cancelMakeup(requestId: string): Promise<AppData> {
  return withTenantScope(() => store.cancelMakeup(requestId));
}

export async function addStudent(
  student: Omit<Student, "id" | "createdAt" | "active">
): Promise<AppData> {
  return withTenantScope(() => store.addStudent(student));
}

export async function addTeacher(
  teacher: Omit<Teacher, "id" | "active" | "color">
): Promise<AppData> {
  return withTenantScope(() => store.addTeacher(teacher));
}

export async function markPaymentPaid(paymentId: string): Promise<AppData> {
  return withTenantScope(() => store.markPaymentPaid(paymentId));
}

export async function addRoom(room: Omit<Room, "id">): Promise<AppData> {
  return withTenantScope(() => store.addRoom(room));
}

export async function addLesson(input: {
  studentId: string;
  teacherId: string;
  roomId: string;
  instrument: Instrument;
  startAt: string;
}): Promise<AppData> {
  return withTenantScope(() => store.addLesson(input));
}

export async function addPayment(input: {
  studentId: string;
  description: string;
  amount: number;
  dueDate: string;
}): Promise<AppData> {
  return withTenantScope(() => store.addPayment(input));
}

export async function updateLessonSchedule(input: {
  lessonId: string;
  startAt?: string;
  durationMinutes?: number;
}): Promise<AppData> {
  return withTenantScope(() => store.updateLessonSchedule(input));
}

export async function cancelLesson(lessonId: string): Promise<AppData> {
  return withTenantScope(() => store.cancelLesson(lessonId));
}

export async function addBranch(branch: Omit<Branch, "id">): Promise<AppData> {
  return withTenantScope(() => store.addBranch(branch));
}

export async function updateBranch(
  branchId: string,
  patch: Partial<Omit<Branch, "id">>
): Promise<AppData> {
  return withTenantScope(() => store.updateBranch(branchId, patch));
}

export async function importBranches(rows: BranchImportRow[]): Promise<ImportCommitResult> {
  return withTenantScope(() => store.importBranches(rows));
}

export async function importTeachers(rows: TeacherImportRow[]): Promise<ImportCommitResult> {
  return withTenantScope(() => store.importTeachers(rows));
}

export async function importRooms(rows: RoomImportRow[]): Promise<ImportCommitResult> {
  return withTenantScope(() => store.importRooms(rows));
}

export async function importStudents(rows: StudentImportRow[]): Promise<ImportCommitResult> {
  return withTenantScope(() => store.importStudents(rows));
}

export async function addLessonSeries(
  params: SeriesParams,
  options?: { skipConflicts?: boolean }
): Promise<CreateSeriesResult> {
  return withTenantScope(() => store.addLessonSeries(params, options));
}

export async function cancelLessonSeriesFromLesson(lessonId: string): Promise<SeriesCancelResult> {
  return withTenantScope(() => store.cancelLessonSeriesFromLesson(lessonId));
}

export async function cancelEntireLessonSeries(seriesId: string): Promise<SeriesCancelResult> {
  return withTenantScope(() => store.cancelEntireLessonSeries(seriesId));
}

export function getDashboardStats(data: AppData) {
  return store.getDashboardStats(data);
}
