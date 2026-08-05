import { withApiHandler } from "@/lib/api/handler";
import { revealNationalIdTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/people/reveal-national-id { entity: "student"|"teacher", entityId } */
export const POST = withApiHandler(async ({ ctx, body }) => revealNationalIdTool(ctx, body), {
  permission: "pii:full",
});
