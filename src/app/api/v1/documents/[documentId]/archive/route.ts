import { withApiHandler } from "@/lib/api/handler";
import { archiveDocumentInstanceTool } from "@/lib/services";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ ctx, params }) => archiveDocumentInstanceTool(ctx, { documentId: params.documentId }),
  { permission: "documents:write" }
);
