import { withApiHandler } from "@/lib/api/handler";
import { createDocumentInstanceTool } from "@/lib/services";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ ctx, body }) => createDocumentInstanceTool(ctx, body), {
  permission: "documents:write",
});
