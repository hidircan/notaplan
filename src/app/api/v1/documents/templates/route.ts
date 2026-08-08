import { withApiHandler } from "@/lib/api/handler";
import { listDocumentTemplatesTool, listAllDocumentTemplatesTool, createDocumentTemplateTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** `?all=1` — Evraklar şablon yönetimi ekranı için arşivlenmiş DAHİL tüm şablonlar (admin-only, tool içinde ayrıca doğrulanır). */
export const GET = withApiHandler(
  async ({ ctx, searchParams }) =>
    searchParams.get("all") === "1" ? listAllDocumentTemplatesTool(ctx) : listDocumentTemplatesTool(ctx),
  { permission: "documents:read" }
);

export const POST = withApiHandler(async ({ ctx, body }) => createDocumentTemplateTool(ctx, body), {
  permission: "documents:write",
});
