import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { getDocumentInstanceTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/documents/:documentId/file — imzalı/taranmış yüklenen sürümü ham baytlar olarak döner. */
export const GET = withApiHandler(
  async ({ ctx, params }) => {
    const result = await getDocumentInstanceTool(ctx, { documentId: params.documentId });
    if (!result.ok) return result;
    const doc = result.data.document;
    if (!doc.fileData) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Dosya yok" } }, { status: 404 });
    }
    const buffer = Buffer.from(doc.fileData, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": doc.fileMimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${(doc.fileName || "evrak").replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  },
  { permission: "documents:read" }
);
