import { withApiHandler } from "@/lib/api/handler";
import { deleteSignedDocumentVersionTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** DELETE /api/v1/documents/:documentId/signed-versions/:versionId — soft-delete, audit'li. */
export const DELETE = withApiHandler(
  async ({ ctx, params }) =>
    deleteSignedDocumentVersionTool(ctx, { documentId: params.documentId, versionId: params.versionId }),
  { permission: "documents:write" }
);
