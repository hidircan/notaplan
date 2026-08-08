import { withApiHandler } from "@/lib/api/handler";
import { updateDocumentTemplateTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/documents/templates/:templateId { name?, bodyHtml? } — bodyHtml sunucuda sanitize edilir. */
export const PATCH = withApiHandler(
  async ({ ctx, body, params }) =>
    updateDocumentTemplateTool(ctx, {
      ...(typeof body === "object" && body !== null ? (body as object) : {}),
      templateId: params.templateId,
    }),
  { permission: "documents:write" }
);
