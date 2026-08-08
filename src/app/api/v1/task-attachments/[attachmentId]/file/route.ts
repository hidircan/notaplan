import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { getTaskAttachmentFileTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/task-attachments/:attachmentId/file — dosyayı ham baytlar
 * olarak döner. Hedefleme + tenant + görev erişim kontrolü TAMAMEN tool
 * katmanında yapılır (getTaskAttachmentFileTool → assertTaskViewAccess) —
 * tıpkı /api/v1/attendance-calendar/month gibi, İş Takip modülünün REST API
 * permission enum'u yok, RBAC her zaman tool içinde uygulanıyor. Asla
 * herkese açık/tahmin edilebilir bir URL değil.
 */
export const GET = withApiHandler(async ({ ctx, params }) => {
  const result = await getTaskAttachmentFileTool(ctx, { attachmentId: params.attachmentId });
  if (!result.ok) return result;
  if (!result.data.fileData) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Dosya yok" } }, { status: 404 });
  }
  const buffer = Buffer.from(result.data.fileData, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": result.data.fileMimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${(result.data.fileName || "ek").replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
});
