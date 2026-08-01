"use server";

/**
 * Web UI server actions — thin adapters over the AI Tool Layer.
 * Auth context from HttpOnly session cookies (not WEB_ADMIN_CONTEXT).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logger } from "./logger";
import {
  cancelMakeupLessonTool,
  confirmMakeupLessonTool,
  createPaymentTool,
  createStudentTool,
  createTeacherTool,
  createBranchTool,
  updateBranchTool,
  createRoomTool,
  createLessonTool,
  suggestLessonSlotsTool,
  updateLessonScheduleTool,
  cancelLessonTool,
  createPaymentRecordTool,
  findAvailableSlotsTool,
  markAttendanceTool,
  resetDemoTool,
} from "./services/tools";
import { runWithTenantAsync } from "./tenant-context";
import { getSessionContext, requireSessionContext } from "./auth/session";
import { readData } from "./store";
import { buildLessonCommunicationDraft, type LessonCommunicationDraft } from "./whatsapp-templates";
import type { LessonSlotSuggestion } from "./lesson-scheduling";
import type { ServiceContext } from "./services/context";

function revalidateAll() {
  revalidatePath("/", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel/ogretmenler");
  revalidatePath("/panel/odalar");
  revalidatePath("/panel/subeler");
  revalidatePath("/panel/veri-aktar");
  revalidatePath("/panel/program");
  revalidatePath("/panel/telafi");
  revalidatePath("/panel/odemeler");
  revalidatePath("/panel/yoklama");
  revalidatePath("/panel/bildirimler");
  revalidatePath("/panel/kurulum");
  revalidatePath("/veli");
  revalidatePath("/ogretmen");
}

function assertOk<T>(result: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

async function withAuthContext<T>(
  fn: (ctx: ServiceContext) => Promise<T>
): Promise<T> {
  const ctx = await requireSessionContext();
  return runWithTenantAsync(ctx.tenantId, () => fn(ctx));
}

export async function actionMarkAttendance(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await markAttendanceTool(ctx, {
          lessonId: String(formData.get("lessonId") || ""),
          status: String(formData.get("status") || ""),
          reason: String(formData.get("reason") || "") || undefined,
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionMarkAttendance failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionGenerateSuggestions(formData: FormData) {
  try {
    const rawMaxSlots = Number(formData.get("maxSlots"));
    const maxSlots = Number.isFinite(rawMaxSlots) && rawMaxSlots > 0 ? rawMaxSlots : undefined;
    await withAuthContext(async (ctx) => {
      assertOk(
        await findAvailableSlotsTool(ctx, {
          requestId: String(formData.get("requestId") || ""),
          maxSlots,
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionGenerateSuggestions failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionConfirmSlot(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      const slotJson = String(formData.get("slot") || "");
      const slot = JSON.parse(slotJson);
      assertOk(
        await confirmMakeupLessonTool(ctx, {
          requestId: String(formData.get("requestId") || ""),
          slot,
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionConfirmSlot failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionCancelMakeup(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await cancelMakeupLessonTool(ctx, {
          requestId: String(formData.get("requestId") || ""),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionCancelMakeup failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionMarkPaymentPaid(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await createPaymentTool(ctx, {
          paymentId: String(formData.get("paymentId") || ""),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionMarkPaymentPaid failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionResetDemo() {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(await resetDemoTool(ctx));
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionResetDemo failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionAddStudent(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await createStudentTool(ctx, {
          name: String(formData.get("name") || ""),
          email: String(formData.get("email") || ""),
          phone: String(formData.get("phone") || ""),
          parentName: String(formData.get("parentName") || ""),
          parentPhone: String(formData.get("parentPhone") || ""),
          branchId: String(formData.get("branchId") || ""),
          instrument: String(formData.get("instrument") || "Piyano"),
          teacherId: String(formData.get("teacherId") || ""),
          packageName: String(formData.get("packageName") || "Bireysel Aylık — 4 ders"),
          weeklyLessonCount: Number(formData.get("weeklyLessonCount") || 1),
          monthlyFee: Number(formData.get("monthlyFee") || 3000),
          notes: String(formData.get("notes") || ""),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionAddStudent failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionAddTeacher(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await createTeacherTool(ctx, {
          name: String(formData.get("name") || ""),
          email: String(formData.get("email") || ""),
          phone: String(formData.get("phone") || ""),
          branchId: String(formData.get("branchId") || ""),
          instrument: String(formData.get("instrument") || "Piyano"),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionAddTeacher failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionAddBranch(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await createBranchTool(ctx, {
          name: String(formData.get("name") || ""),
          shortName: String(formData.get("shortName") || ""),
          city: String(formData.get("city") || ""),
          phone: String(formData.get("phone") || ""),
          address: String(formData.get("address") || ""),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionAddBranch failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionUpdateBranch(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await updateBranchTool(ctx, {
          branchId: String(formData.get("branchId") || ""),
          name: String(formData.get("name") || ""),
          shortName: String(formData.get("shortName") || ""),
          city: String(formData.get("city") || ""),
          phone: String(formData.get("phone") || ""),
          address: String(formData.get("address") || ""),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionUpdateBranch failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionAddRoom(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await createRoomTool(ctx, {
          name: String(formData.get("name") || ""),
          branchId: String(formData.get("branchId") || ""),
          capacity: Number(formData.get("capacity") || 2),
          instruments: formData.getAll("instruments").map(String),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionAddRoom failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export type LessonActionResult =
  | { ok: true; lessonId: string; communication: LessonCommunicationDraft | null }
  | { ok: false; message: string };

/**
 * Hata durumunda fırlatmaz — Program Stüdyosu client bileşeni sonucu
 * doğrudan gösterip forma bağlamında Türkçe bir hata göstersin diye
 * `{ ok: false, message }` döner. Başarıda, ders için otomatik gönderim
 * yapılmayan veli/öğretmen iletişim taslağını da birlikte döndürür.
 */
export async function actionAddLesson(formData: FormData): Promise<LessonActionResult> {
  try {
    const result = await withAuthContext(async (ctx) => {
      const startAtRaw = String(formData.get("startAt") || "");
      const startAt = startAtRaw ? new Date(startAtRaw).toISOString() : "";
      const created = await createLessonTool(ctx, {
        studentId: String(formData.get("studentId") || ""),
        teacherId: String(formData.get("teacherId") || ""),
        roomId: String(formData.get("roomId") || ""),
        instrument: String(formData.get("instrument") || "Piyano"),
        startAt,
      });
      if (!created.ok) {
        return { ok: false as const, message: created.error.message };
      }

      const data = await readData();
      const lesson = data.lessons.find((l) => l.id === created.data.lessonId);
      const student = data.students.find((s) => s.id === lesson?.studentId);
      const teacher = data.teachers.find((t) => t.id === lesson?.teacherId);
      const branch = data.settings.branches.find((b) => b.id === lesson?.branchId);
      const communication =
        lesson && student && teacher
          ? buildLessonCommunicationDraft(
              data.settings.name,
              student,
              teacher,
              lesson,
              branch?.shortName ?? ""
            )
          : null;

      return { ok: true as const, lessonId: created.data.lessonId, communication };
    });
    if (result.ok) revalidateAll();
    return result;
  } catch (error) {
    logger.error("actionAddLesson failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "Ders planlanırken beklenmeyen bir hata oluştu." };
  }
}

export type SuggestLessonSlotsResult =
  | { ok: true; suggestions: LessonSlotSuggestion[] }
  | { ok: false; message: string };

export async function actionSuggestLessonSlots(input: {
  studentId: string;
  instrument: string;
  teacherId?: string;
  daysAhead?: number;
  maxSlots?: number;
}): Promise<SuggestLessonSlotsResult> {
  try {
    return await withAuthContext(async (ctx) => {
      const result = await suggestLessonSlotsTool(ctx, input);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      return { ok: true as const, suggestions: result.data.suggestions };
    });
  } catch (error) {
    logger.error("actionSuggestLessonSlots failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "Uygun saatler aranırken beklenmeyen bir hata oluştu." };
  }
}

export type LessonUpdateActionResult =
  | { ok: true; lessonId: string; startAt: string; endAt: string }
  | { ok: false; message: string };

/**
 * Sürükle-bırak taşıma, resize ve ileride manuel "dersi taşı" formu için TEK
 * ortak yol — hepsi aynı tool/store fonksiyonunu (dolayısıyla aynı
 * validateLessonSlot doğrulamasını) paylaşır. Hata durumunda fırlatmaz;
 * takvim UI'ı sonucu doğrudan gösterip kısa Türkçe hata verebilsin diye
 * `{ ok: false, message }` döner.
 */
export async function actionUpdateLessonSchedule(input: {
  lessonId: string;
  startAt?: string;
  durationMinutes?: number;
}): Promise<LessonUpdateActionResult> {
  try {
    const result = await withAuthContext((ctx) => updateLessonScheduleTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, ...result.data };
  } catch (error) {
    logger.error("actionUpdateLessonSchedule failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "Ders güncellenirken beklenmeyen bir hata oluştu." };
  }
}

export type CancelLessonActionResult = { ok: true } | { ok: false; message: string };

export async function actionCancelLesson(input: { lessonId: string }): Promise<CancelLessonActionResult> {
  try {
    const result = await withAuthContext((ctx) => cancelLessonTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true };
  } catch (error) {
    logger.error("actionCancelLesson failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "Ders iptal edilirken beklenmeyen bir hata oluştu." };
  }
}

export async function actionAddPayment(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await createPaymentRecordTool(ctx, {
          studentId: String(formData.get("studentId") || ""),
          description: String(formData.get("description") || ""),
          amount: Number(formData.get("amount") || 0),
          dueDate: String(formData.get("dueDate") || ""),
        })
      );
    });
    revalidateAll();
  } catch (error) {
    logger.error("actionAddPayment failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function actionLogout() {
  // Cookie clear via API for consistent Set-Cookie
  // Server action fallback: redirect after client fetch preferred
  redirect("/login");
}

/** Used by logout button — returns after client calls /api/v1/auth/logout */
export async function actionRequireAuth(): Promise<boolean> {
  const ctx = await getSessionContext();
  return Boolean(ctx);
}
