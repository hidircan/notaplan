import { withApiHandler } from "@/lib/api/handler";
import { listDocumentTemplatesTool } from "@/lib/services";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ ctx }) => listDocumentTemplatesTool(ctx), {
  permission: "documents:read",
});
