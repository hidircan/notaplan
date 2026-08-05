import { withApiHandler } from "@/lib/api/handler";
import { uploadSignedDocumentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/documents/:documentId/upload-signed { fileName, fileMimeType, fileData } */
export const POST = withApiHandler(
  async ({ ctx, body, params }) =>
    uploadSignedDocumentTool(ctx, {
      ...(typeof body === "object" && body !== null ? (body as object) : {}),
      documentId: params.documentId,
    }),
  { permission: "documents:write" }
);
