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
  createRoomTool,
  findAvailableSlotsTool,
  markAttendanceTool,
  resetDemoTool,
} from "./services/tools";
import { runWithTenantAsync } from "./tenant-context";
import { getSessionContext, requireSessionContext } from "./auth/session";
import type { ServiceContext } from "./services/context";

function revalidateAll() {
  revalidatePath("/", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel/ogretmenler");
  revalidatePath("/panel/odalar");
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
          branchId: String(formData.get("branchId") || "erzene"),
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
          branchId: String(formData.get("branchId") || "erzene"),
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

export async function actionAddRoom(formData: FormData) {
  try {
    await withAuthContext(async (ctx) => {
      assertOk(
        await createRoomTool(ctx, {
          name: String(formData.get("name") || ""),
          branchId: String(formData.get("branchId") || "erzene"),
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
