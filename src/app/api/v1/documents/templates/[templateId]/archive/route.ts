import { withApiHandler } from "@/lib/api/handler";
import { archiveDocumentTemplateTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/documents/templates/:templateId/archive { active: boolean } — arşivle (false) veya geri aç (true). */
export const POST = withApiHandler(
  async ({ ctx, body, params }) =>
    archiveDocumentTemplateTool(ctx, {
      ...(typeof body === "object" && body !== null ? (body as object) : {}),
      templateId: params.templateId,
    }),
  { permission: "documents:write" }
);
