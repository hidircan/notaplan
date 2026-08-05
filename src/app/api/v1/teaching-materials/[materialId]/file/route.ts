import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { getTeachingMaterialFileTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/teaching-materials/:materialId/file — dosyayı ham baytlar
 * olarak döner. Hedefleme + sahiplik kontrolü tool katmanında yapılır (bkz.
 * getTeachingMaterialFileTool) — asla herkese açık/tahmin edilebilir değil.
 */
export const GET = withApiHandler(
  async ({ ctx, params }) => {
    const result = await getTeachingMaterialFileTool(ctx, { materialId: params.materialId });
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
  { permission: "materials:read" }
);
