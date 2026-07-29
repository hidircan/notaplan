import { STORE_MODE } from "./config";
import * as jsonStore from "./store-json";
import type {
  AppData,
  AttendanceStatus,
  MakeupSlot,
  Student,
  Teacher,
} from "./types";

type StoreApi = {
  readData: () => Promise<AppData>;
  resetData: () => Promise<AppData>;
  markAttendance: (input: {
    lessonId: string;
    status: AttendanceStatus;
    reason?: string;
  }) => Promise<AppData>;
  generateSuggestions: (requestId: string) => Promise<AppData>;
  confirmSlot: (requestId: string, slot: MakeupSlot) => Promise<AppData>;
  cancelMakeup: (requestId: string) => Promise<AppData>;
  addStudent: (student: Omit<Student, "id" | "createdAt" | "active">) => Promise<AppData>;
  addTeacher: (teacher: Omit<Teacher, "id" | "active" | "color">) => Promise<AppData>;
  markPaymentPaid: (paymentId: string) => Promise<AppData>;
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
  return withTenantScope(() => store.readData());
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

export async function generateSuggestions(requestId: string): Promise<AppData> {
  return withTenantScope(() => store.generateSuggestions(requestId));
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

export function getDashboardStats(data: AppData) {
  return store.getDashboardStats(data);
}
