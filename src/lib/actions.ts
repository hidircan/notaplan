"use server";

/**
 * Web UI server actions — thin adapters over the AI Tool Layer.
 * Auth context from HttpOnly session cookies (not WEB_ADMIN_CONTEXT).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { logger } from "./logger";
import { KURUM_COOKIE, listAvailableKurumlar, pickInstitutionSelection } from "./institution/context";
import { resolveWriteScope, WriteScopeDeniedError } from "./institution/write-scope";
import { THEME_PROFILE_COOKIE, FONT_COOKIE, normalizeThemeProfile, normalizeFontChoice } from "./theme";
import { auditLog } from "./auth/audit";
import { uid } from "./utils";
import {
  cancelMakeupLessonTool,
  confirmMakeupLessonTool,
  createPaymentTool,
  createStudentTool,
  updateStudentProfileTool,
  archiveStudentTool,
  createTeacherTool,
  createBranchTool,
  updateBranchTool,
  previewBranchImportTool,
  commitBranchImportTool,
  previewTeacherImportTool,
  commitTeacherImportTool,
  previewRoomImportTool,
  commitRoomImportTool,
  previewStudentImportTool,
  commitStudentImportTool,
  createRoomTool,
  createLessonTool,
  suggestLessonSlotsTool,
  updateLessonScheduleTool,
  cancelLessonTool,
  previewLessonSeriesTool,
  createLessonSeriesTool,
  cancelSeriesFromLessonTool,
  cancelEntireSeriesTool,
  createPaymentRecordTool,
  createFeeRuleTool,
  updateFeeRuleTool,
  computeTeacherPayoutTool,
  createTeacherPayoutTool,
  markTeacherPayoutPaidTool,
  updateFeeRoundingModeTool,
  findAvailableSlotsTool,
  markAttendanceTool,
  updateCommunicationPreferenceTool,
  updateCollectionsSettingsTool,
  markNotificationReadTool,
  resetDemoTool,
} from "./services/tools";
import { runWithTenantAsync } from "./tenant-context";
import { getSessionContext, requireSessionContext } from "./auth/session";
import { readData } from "./store";
import { buildLessonCommunicationDraft, type LessonCommunicationDraft } from "./whatsapp-templates";
import type { LessonSlotSuggestion } from "./lesson-scheduling";
import type { SeriesOccurrenceCheck } from "./lesson-series";
import type { TeacherEarningsResult } from "./teacher-payout";
import type { FeeRoundingMode, TeacherFeeRule, TeacherPayout } from "./types";
import type { ImportPreview } from "./import/types";
import type { ImportCommitResult } from "./import/commit-result";
import type { BranchImportRow } from "./import/branches";
import type { TeacherImportRow } from "./import/teachers";
import type { RoomImportRow } from "./import/rooms";
import type { StudentImportRow } from "./import/students";
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

/**
 * Her yazma aksiyonunun TEK giriş noktası. Hangi kurumda çalışılacağını
 * (writeScope.tenantId) sunucu tarafında, taze oturum + cookie'den çözer —
 * istemciden gelen hiçbir tenant id'sine güvenilmez (bkz. write-scope.ts).
 * "Tüm kurumlar" görünümünde veya erişilemeyen bir kurumda YAZMA denenirse
 * mutasyon hiç çalıştırılmadan reddedilir. Her çağrı, ham payload/mesaj
 * içermeyen güvenli bir denetim (audit) kaydı bırakır: aktör, çözülen kurum,
 * kapsam modu, aksiyon adı, sonuç.
 */
async function withAuthContext<T>(
  actionName: string,
  fn: (ctx: ServiceContext) => Promise<T>
): Promise<T> {
  const ctx = await requireSessionContext();
  const requestId = uid("audit");
  const writeScope = await resolveWriteScope(ctx);

  if (writeScope.mode !== "single") {
    auditLog({
      action: actionName,
      requestId,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      role: ctx.role,
      outcome: "denied",
      meta: { scopeMode: writeScope.mode },
    });
    throw new WriteScopeDeniedError(writeScope.reason);
  }

  try {
    const result = await runWithTenantAsync(writeScope.tenantId, () => fn(ctx));
    auditLog({
      action: actionName,
      requestId,
      userId: ctx.userId,
      tenantId: writeScope.tenantId,
      role: ctx.role,
      outcome: "success",
      meta: { scopeMode: "single" },
    });
    return result;
  } catch (error) {
    auditLog({
      action: actionName,
      requestId,
      userId: ctx.userId,
      tenantId: writeScope.tenantId,
      role: ctx.role,
      outcome: "error",
      meta: { scopeMode: "single" },
    });
    throw error;
  }
}

/**
 * Görünür kurum seçicinin tetiklediği aksiyon. Tercih yalnızca kullanıcının
 * erişebildiği kurumlardan biriyse (veya "Tüm kurumlar" ise ve kullanıcı
 * kurum sahibiyse) kabul edilir; geçersiz bir istekte sessizce varsayılana
 * döner. Panel'in tamamı yeniden render edilir ki her ekran yeni seçime göre
 * güncellensin.
 */
export async function actionSetKurum(selection: string): Promise<void> {
  const ctx = await requireSessionContext();
  const available = await listAvailableKurumlar(ctx);
  const resolved = pickInstitutionSelection(ctx.role, ctx.tenantId, available, selection);
  const jar = await cookies();
  jar.set(KURUM_COOKIE, resolved, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

/**
 * Görünüm tercihleri (tema profili / yazı tipi) — kimlik doğrulama veya
 * kurum kapsamından TAMAMEN bağımsızdır; oturum gerektirmez (login
 * ekranında da çalışsın diye) ve hiçbir yetki/kurum/veri kararını
 * etkilemez. Yalnızca kullanıcının kişisel görsel cookie'leridir.
 */
export async function actionSetThemeProfile(profile: string): Promise<void> {
  const normalized = normalizeThemeProfile(profile);
  const jar = await cookies();
  jar.set(THEME_PROFILE_COOKIE, normalized, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function actionSetFont(font: string): Promise<void> {
  const normalized = normalizeFontChoice(font);
  const jar = await cookies();
  jar.set(FONT_COOKIE, normalized, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

/** Görünüm ayarlarını fabrika varsayılanına döndürür (Kurumsal Altın + Kurumsal Sans). */
export async function actionResetThemePreferences(): Promise<void> {
  const jar = await cookies();
  jar.delete(THEME_PROFILE_COOKIE);
  jar.delete(FONT_COOKIE);
  revalidatePath("/", "layout");
}

export async function actionMarkAttendance(formData: FormData) {
  try {
    await withAuthContext("actionMarkAttendance", async (ctx) => {
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
    await withAuthContext("actionGenerateSuggestions", async (ctx) => {
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
    await withAuthContext("actionConfirmSlot", async (ctx) => {
      const slotJson = String(formData.get("slot") || "");
      const slot = JSON.parse(slotJson);
      assertOk(
        await confirmMakeupLessonTool(ctx, {
          requestId: String(formData.get("requestId") || ""),
          slot,
          decisionNote: String(formData.get("decisionNote") || ""),
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
    await withAuthContext("actionCancelMakeup", async (ctx) => {
      assertOk(
        await cancelMakeupLessonTool(ctx, {
          requestId: String(formData.get("requestId") || ""),
          decisionNote: String(formData.get("decisionNote") || ""),
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
    await withAuthContext("actionMarkPaymentPaid", async (ctx) => {
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
    await withAuthContext("actionResetDemo", async (ctx) => {
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
    await withAuthContext("actionAddStudent", async (ctx) => {
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
          studentType: String(formData.get("studentType") || "") || undefined,
          enrollmentStartDate: String(formData.get("enrollmentStartDate") || "") || undefined,
          level: String(formData.get("level") || "") || undefined,
          targetExam: String(formData.get("targetExam") || "") || undefined,
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

export type UpdateStudentProfileActionResult = { ok: true } | { ok: false; message: string };

export async function actionUpdateStudentProfile(input: {
  studentId: string;
  studentType?: string;
  enrollmentStartDate?: string;
  enrollmentEndDate?: string;
  level?: string;
  targetExam?: string;
  specialNotes?: string;
}): Promise<UpdateStudentProfileActionResult> {
  try {
    const result = await withAuthContext("actionUpdateStudentProfile", (ctx) =>
      updateStudentProfileTool(ctx, input)
    );
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true };
  } catch (error) {
    logger.error("actionUpdateStudentProfile failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "Öğrenci profili güncellenirken beklenmeyen bir hata oluştu." };
  }
}

export type ArchiveStudentActionResult = { ok: true } | { ok: false; message: string };

/** Pasife alma/aktifleştirme — hard delete yok, tool katmanı SCHOOL_ADMIN/SUPER_ADMIN'e kısıtlar. */
export async function actionArchiveStudent(input: {
  studentId: string;
  archived: boolean;
}): Promise<ArchiveStudentActionResult> {
  try {
    const result = await withAuthContext("actionArchiveStudent", (ctx) =>
      archiveStudentTool(ctx, input)
    );
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true };
  } catch (error) {
    logger.error("actionArchiveStudent failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "Öğrenci durumu güncellenirken beklenmeyen bir hata oluştu." };
  }
}

export type UpdateCommunicationPreferenceActionResult = { ok: true } | { ok: false; message: string };

/** EPIC 1 — veli kendi çocuğu için, admin herkes için çağırabilir (tool katmanı RBAC'ı uygular). */
export async function actionUpdateCommunicationPreference(input: {
  studentId: string;
  communicationOptOut: boolean;
}): Promise<UpdateCommunicationPreferenceActionResult> {
  try {
    const result = await withAuthContext("actionUpdateCommunicationPreference", (ctx) =>
      updateCommunicationPreferenceTool(ctx, input)
    );
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true };
  } catch (error) {
    logger.error("actionUpdateCommunicationPreference failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "İletişim tercihi güncellenirken beklenmeyen bir hata oluştu." };
  }
}

export type UpdateCollectionsSettingsActionResult = { ok: true } | { ok: false; message: string };

export async function actionUpdateCollectionsSettings(input: {
  frequencyLimitDays: number;
  autoSendEnabled: boolean;
}): Promise<UpdateCollectionsSettingsActionResult> {
  try {
    const result = await withAuthContext("actionUpdateCollectionsSettings", (ctx) =>
      updateCollectionsSettingsTool(ctx, input)
    );
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true };
  } catch (error) {
    logger.error("actionUpdateCollectionsSettings failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return {
      ok: false,
      message: "Tahsilat otomasyon ayarları güncellenirken beklenmeyen bir hata oluştu.",
    };
  }
}

export type MarkNotificationReadActionResult = { ok: true } | { ok: false; message: string };

export async function actionMarkNotificationRead(
  notificationId: string
): Promise<MarkNotificationReadActionResult> {
  try {
    const result = await withAuthContext("actionMarkNotificationRead", (ctx) =>
      markNotificationReadTool(ctx, { notificationId })
    );
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidatePath("/veli");
    revalidatePath("/panel/bildirimler");
    return { ok: true };
  } catch (error) {
    logger.error("actionMarkNotificationRead failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    return { ok: false, message: "Bildirim okundu işaretlenirken beklenmeyen bir hata oluştu." };
  }
}

export async function actionAddTeacher(formData: FormData) {
  try {
    await withAuthContext("actionAddTeacher", async (ctx) => {
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
    await withAuthContext("actionAddBranch", async (ctx) => {
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
    await withAuthContext("actionUpdateBranch", async (ctx) => {
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

export type ImportPreviewActionResult<T> =
  | { ok: true; preview: ImportPreview<T> }
  | { ok: false; message: string };

export type ImportCommitActionResult =
  | { ok: true; result: ImportCommitResult }
  | { ok: false; message: string };

export async function actionPreviewBranchImport(csvText: string): Promise<ImportPreviewActionResult<BranchImportRow>> {
  try {
    const result = await withAuthContext("actionPreviewBranchImport", (ctx) => previewBranchImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    return { ok: true, preview: result.data };
  } catch (error) {
    logger.error("actionPreviewBranchImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Önizleme sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionCommitBranchImport(csvText: string): Promise<ImportCommitActionResult> {
  try {
    const result = await withAuthContext("actionCommitBranchImport", (ctx) => commitBranchImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, result: result.data };
  } catch (error) {
    logger.error("actionCommitBranchImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "İçe aktarım sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionPreviewTeacherImport(csvText: string): Promise<ImportPreviewActionResult<TeacherImportRow>> {
  try {
    const result = await withAuthContext("actionPreviewTeacherImport", (ctx) => previewTeacherImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    return { ok: true, preview: result.data };
  } catch (error) {
    logger.error("actionPreviewTeacherImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Önizleme sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionCommitTeacherImport(csvText: string): Promise<ImportCommitActionResult> {
  try {
    const result = await withAuthContext("actionCommitTeacherImport", (ctx) => commitTeacherImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, result: result.data };
  } catch (error) {
    logger.error("actionCommitTeacherImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "İçe aktarım sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionPreviewRoomImport(csvText: string): Promise<ImportPreviewActionResult<RoomImportRow>> {
  try {
    const result = await withAuthContext("actionPreviewRoomImport", (ctx) => previewRoomImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    return { ok: true, preview: result.data };
  } catch (error) {
    logger.error("actionPreviewRoomImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Önizleme sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionCommitRoomImport(csvText: string): Promise<ImportCommitActionResult> {
  try {
    const result = await withAuthContext("actionCommitRoomImport", (ctx) => commitRoomImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, result: result.data };
  } catch (error) {
    logger.error("actionCommitRoomImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "İçe aktarım sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionPreviewStudentImport(csvText: string): Promise<ImportPreviewActionResult<StudentImportRow>> {
  try {
    const result = await withAuthContext("actionPreviewStudentImport", (ctx) => previewStudentImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    return { ok: true, preview: result.data };
  } catch (error) {
    logger.error("actionPreviewStudentImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Önizleme sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionCommitStudentImport(csvText: string): Promise<ImportCommitActionResult> {
  try {
    const result = await withAuthContext("actionCommitStudentImport", (ctx) => commitStudentImportTool(ctx, { csvText }));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, result: result.data };
  } catch (error) {
    logger.error("actionCommitStudentImport failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "İçe aktarım sırasında beklenmeyen bir hata oluştu." };
  }
}

export async function actionAddRoom(formData: FormData) {
  try {
    await withAuthContext("actionAddRoom", async (ctx) => {
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
    const result = await withAuthContext("actionAddLesson", async (ctx) => {
      const startAtRaw = String(formData.get("startAt") || "");
      const startAt = startAtRaw ? new Date(startAtRaw).toISOString() : "";
      const durationRaw = formData.get("durationMinutes");
      const created = await createLessonTool(ctx, {
        studentId: String(formData.get("studentId") || ""),
        teacherId: String(formData.get("teacherId") || ""),
        roomId: String(formData.get("roomId") || ""),
        instrument: String(formData.get("instrument") || "Piyano"),
        startAt,
        durationMinutes: durationRaw ? Number(durationRaw) : undefined,
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
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
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
    return await withAuthContext("actionSuggestLessonSlots", async (ctx) => {
      const result = await suggestLessonSlotsTool(ctx, input);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      return { ok: true as const, suggestions: result.data.suggestions };
    });
  } catch (error) {
    logger.error("actionSuggestLessonSlots failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
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
    const result = await withAuthContext("actionUpdateLessonSchedule", (ctx) => updateLessonScheduleTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, ...result.data };
  } catch (error) {
    logger.error("actionUpdateLessonSchedule failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Ders güncellenirken beklenmeyen bir hata oluştu." };
  }
}

export type CancelLessonActionResult = { ok: true } | { ok: false; message: string };

export async function actionCancelLesson(input: { lessonId: string }): Promise<CancelLessonActionResult> {
  try {
    const result = await withAuthContext("actionCancelLesson", (ctx) => cancelLessonTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true };
  } catch (error) {
    logger.error("actionCancelLesson failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Ders iptal edilirken beklenmeyen bir hata oluştu." };
  }
}

export type LessonSeriesParamsInput = {
  studentId: string;
  teacherId: string;
  roomId: string;
  branchId: string;
  instrument: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  startsOn: string;
  endsOn: string;
};

export type PreviewLessonSeriesActionResult =
  | { ok: true; previewText: string; occurrenceCount: number; conflictCount: number; checks: SeriesOccurrenceCheck[] }
  | { ok: false; message: string };

export async function actionPreviewLessonSeries(
  input: LessonSeriesParamsInput
): Promise<PreviewLessonSeriesActionResult> {
  try {
    const result = await withAuthContext("actionPreviewLessonSeries", (ctx) => previewLessonSeriesTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    return { ok: true, ...result.data };
  } catch (error) {
    logger.error("actionPreviewLessonSeries failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Önizleme sırasında beklenmeyen bir hata oluştu." };
  }
}

export type CreateLessonSeriesActionResult =
  | {
      ok: true;
      seriesId: string;
      createdLessonIds: string[];
      skippedOccurrences: { startAt: string; code: string; message: string }[];
    }
  | { ok: false; message: string; conflicts?: SeriesOccurrenceCheck[] };

export async function actionCreateLessonSeries(
  input: LessonSeriesParamsInput & { skipConflicts?: boolean }
): Promise<CreateLessonSeriesActionResult> {
  try {
    const result = await withAuthContext("actionCreateLessonSeries", (ctx) => createLessonSeriesTool(ctx, input));
    if (!result.ok) {
      return {
        ok: false,
        message: result.error.message,
        conflicts: result.error.details as SeriesOccurrenceCheck[] | undefined,
      };
    }
    revalidateAll();
    return { ok: true, ...result.data };
  } catch (error) {
    logger.error("actionCreateLessonSeries failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Seri oluşturulurken beklenmeyen bir hata oluştu." };
  }
}

export type SeriesCancelActionResult = { ok: true; cancelledLessonIds: string[] } | { ok: false; message: string };

export async function actionCancelSeriesFromLesson(input: { lessonId: string }): Promise<SeriesCancelActionResult> {
  try {
    const result = await withAuthContext("actionCancelSeriesFromLesson", (ctx) => cancelSeriesFromLessonTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, cancelledLessonIds: result.data.cancelledLessonIds };
  } catch (error) {
    logger.error("actionCancelSeriesFromLesson failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Seri iptal edilirken beklenmeyen bir hata oluştu." };
  }
}

export async function actionCancelEntireSeries(input: { seriesId: string }): Promise<SeriesCancelActionResult> {
  try {
    const result = await withAuthContext("actionCancelEntireSeries", (ctx) => cancelEntireSeriesTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, cancelledLessonIds: result.data.cancelledLessonIds };
  } catch (error) {
    logger.error("actionCancelEntireSeries failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Seri iptal edilirken beklenmeyen bir hata oluştu." };
  }
}

export async function actionAddPayment(formData: FormData) {
  try {
    await withAuthContext("actionAddPayment", async (ctx) => {
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

export type CreateFeeRuleActionInput = {
  teacherId: string;
  branchId?: string;
  instrument?: string;
  perMinuteRate: number;
  effectiveFrom: string;
  effectiveTo?: string;
};

export type UpdateFeeRuleActionInput = {
  ruleId: string;
  teacherId?: string;
  branchId?: string;
  instrument?: string;
  perMinuteRate?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type FeeRuleActionResult = { ok: true; rule: TeacherFeeRule } | { ok: false; message: string };

export async function actionCreateFeeRule(input: CreateFeeRuleActionInput): Promise<FeeRuleActionResult> {
  try {
    const result = await withAuthContext("actionCreateFeeRule", (ctx) => createFeeRuleTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, rule: result.data.rule };
  } catch (error) {
    logger.error("actionCreateFeeRule failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Ücret kuralı oluşturulurken beklenmeyen bir hata oluştu." };
  }
}

export async function actionUpdateFeeRule(input: UpdateFeeRuleActionInput): Promise<FeeRuleActionResult> {
  try {
    const result = await withAuthContext("actionUpdateFeeRule", (ctx) => updateFeeRuleTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, rule: result.data.rule };
  } catch (error) {
    logger.error("actionUpdateFeeRule failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Ücret kuralı güncellenirken beklenmeyen bir hata oluştu." };
  }
}

export type ComputeTeacherPayoutActionResult =
  | ({ ok: true } & TeacherEarningsResult)
  | { ok: false; message: string };

/** Salt-okunur önizleme — hiçbir kayıt yazmaz. */
export async function actionComputeTeacherPayout(input: {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ComputeTeacherPayoutActionResult> {
  try {
    const result = await withAuthContext("actionComputeTeacherPayout", (ctx) => computeTeacherPayoutTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    return { ok: true, ...result.data };
  } catch (error) {
    logger.error("actionComputeTeacherPayout failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Hakediş hesaplanırken beklenmeyen bir hata oluştu." };
  }
}

export type TeacherPayoutActionResult = { ok: true; payout: TeacherPayout } | { ok: false; message: string };

export async function actionCreateTeacherPayout(input: {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<TeacherPayoutActionResult> {
  try {
    const result = await withAuthContext("actionCreateTeacherPayout", (ctx) => createTeacherPayoutTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, payout: result.data.payout };
  } catch (error) {
    logger.error("actionCreateTeacherPayout failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Hakediş kaydı oluşturulurken beklenmeyen bir hata oluştu." };
  }
}

export async function actionMarkTeacherPayoutPaid(input: {
  payoutId: string;
  method?: string;
}): Promise<TeacherPayoutActionResult> {
  try {
    const result = await withAuthContext("actionMarkTeacherPayoutPaid", (ctx) => markTeacherPayoutPaidTool(ctx, input));
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, payout: result.data.payout };
  } catch (error) {
    logger.error("actionMarkTeacherPayoutPaid failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Hakediş ödendi olarak işaretlenirken beklenmeyen bir hata oluştu." };
  }
}

export type UpdateFeeRoundingModeActionResult =
  | { ok: true; feeRoundingMode: FeeRoundingMode }
  | { ok: false; message: string };

export async function actionUpdateFeeRoundingMode(
  feeRoundingMode: FeeRoundingMode
): Promise<UpdateFeeRoundingModeActionResult> {
  try {
    const result = await withAuthContext("actionUpdateFeeRoundingMode", (ctx) =>
      updateFeeRoundingModeTool(ctx, { feeRoundingMode })
    );
    if (!result.ok) return { ok: false, message: result.error.message };
    revalidateAll();
    return { ok: true, feeRoundingMode: result.data.feeRoundingMode };
  } catch (error) {
    logger.error("actionUpdateFeeRoundingMode failed", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof WriteScopeDeniedError) return { ok: false, message: error.message };
    return { ok: false, message: "Ücret yuvarlama politikası güncellenirken beklenmeyen bir hata oluştu." };
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
