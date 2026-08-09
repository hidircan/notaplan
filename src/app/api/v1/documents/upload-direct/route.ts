import { withApiHandler } from "@/lib/api/handler";
import { uploadDocumentDirectTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/documents/upload-direct { kind, fileName, fileMimeType, fileData, studentId?, teacherId? }
 * Şablon doldurmadan, kategori seçip doğrudan dosya yükleme.
 */
export const POST = withApiHandler(
  async ({ ctx, body }) => uploadDocumentDirectTool(ctx, body),
  { permission: "documents:write" }
);
