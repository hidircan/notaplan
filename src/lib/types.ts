/** Şimdilik aktif enstrümanlar; ileride genişletilecek */
export type Instrument =
  | "Piyano"
  | "Yan Flüt"
  | "Gitar"
  | "Bateri"
  | "Keman"
  | "Şan";

export const INSTRUMENTS: Instrument[] = [
  "Piyano",
  "Yan Flüt",
  "Gitar",
  "Bateri",
  "Keman",
  "Şan",
];

export type BranchId = "erzene" | "evka3";

export interface Branch {
  id: BranchId;
  name: string;
  shortName: string;
  address: string;
  phone: string;
  city: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "cancelled_by_school";
export type MakeupStatus = "pending" | "suggested" | "confirmed" | "completed" | "expired" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "overdue" | "partial";
export type LessonType = "regular" | "makeup" | "trial" | "group";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  branchId: BranchId;
  instruments: Instrument[];
  /** Haftalık müsaitlik: 0=Pazar ... 6=Cumartesi */
  availability: { dayOfWeek: number; start: string; end: string }[];
  maxDailyLessons: number;
  active: boolean;
  color: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  branchId: BranchId;
  instruments: Instrument[];
  teacherId: string;
  packageName: string;
  weeklyLessonCount: number;
  monthlyFee: number;
  active: boolean;
  notes: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  branchId: BranchId;
  capacity: number;
  instruments: Instrument[];
}

export interface Lesson {
  id: string;
  studentId: string;
  teacherId: string;
  roomId: string;
  branchId: BranchId;
  instrument: Instrument;
  startAt: string;
  endAt: string;
  type: LessonType;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  makeupRequestId?: string;
  notes?: string;
}

export interface Attendance {
  id: string;
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
  reason?: string;
  markedAt: string;
  createsMakeupCredit: boolean;
}

export interface MakeupRequest {
  id: string;
  studentId: string;
  teacherId: string;
  branchId: BranchId;
  instrument: Instrument;
  sourceLessonId: string;
  attendanceId: string;
  status: MakeupStatus;
  reason: string;
  expiresAt: string;
  suggestedSlots: MakeupSlot[];
  confirmedLessonId?: string;
  createdAt: string;
  policyNote: string;
}

export interface MakeupSlot {
  startAt: string;
  endAt: string;
  teacherId: string;
  roomId: string;
  branchId: BranchId;
  score: number;
  reasons: string[];
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  paidAmount: number;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
  description: string;
  method?: string;
}

export interface SchoolSettings {
  /** Multi-tenant id — set at seed / DB; never from client */
  tenantId: string;
  name: string;
  shortName: string;
  city: string;
  website: string;
  email: string;
  phone: string;
  logoUrl: string;
  makeupWindowDays: number;
  lessonDurationMinutes: number;
  workingHours: { start: string; end: string };
  workingDays: number[];
  currency: string;
  branches: Branch[];
}

export interface AppData {
  settings: SchoolSettings;
  teachers: Teacher[];
  students: Student[];
  rooms: Room[];
  lessons: Lesson[];
  attendances: Attendance[];
  makeupRequests: MakeupRequest[];
  payments: Payment[];
}
