import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { getHomeworkSubmissionFileTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/homework-submissions/:submissionId/file — dosyayı ham baytlar
 * olarak döner (base64 → Buffer). Sahiplik kontrolü tool katmanında yapılır
 * (bkz. getHomeworkSubmissionFileTool); bu rota ASLA parametresiz/herkese
 * açık bir dosya sunucusu değildir — her istek oturum + RBAC'tan geçer.
 */
export const GET = withApiHandler(
  async ({ ctx, params }) => {
    const result = await getHomeworkSubmissionFileTool(ctx, { submissionId: params.submissionId });
    if (!result.ok) return result;
    if (!result.data.fileData) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Dosya yok" } }, { status: 404 });
    }
    const buffer = Buffer.from(result.data.fileData, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": result.data.fileMimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${(result.data.fileName || "dosya").replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  },
  { permission: "homework:read" }
);
