import { withApiHandler } from "@/lib/api/handler";
import { printDocumentInstanceTool } from "@/lib/services";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ ctx, params }) => printDocumentInstanceTool(ctx, { documentId: params.documentId }),
  { permission: "documents:write" }
);
