import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult } from "@/lib/api/http";
import { collectAttendanceCalendarPaymentTool } from "@/lib/services/tools";

export const dynamic = "force-dynamic";

/**
 * POST { studentId, month (yyyy-MM), amount, dueDate?, method? } — Yoklama
 * Takvimi ay kutusu "Kaydet" — GERÇEK bir tahsilat işlemidir (idempotent:
 * aynı öğrenci+ay için tekrar çağrı yeni kayıt üretmez, aynı Payment'ı
 * günceller). bkz. collectAttendanceCalendarPaymentTool.
 */
export const POST = withApiHandler(async ({ ctx, body }) => {
  const result = await collectAttendanceCalendarPaymentTool(ctx, body);
  return fromServiceResult(result);
});
