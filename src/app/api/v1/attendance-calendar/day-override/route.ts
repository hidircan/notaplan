import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult } from "@/lib/api/http";
import { setDayOverrideTool } from "@/lib/services/tools";

export const dynamic = "force-dynamic";

/** POST { date, name?, isOpen, kind? } — admin manuel kapalı/zorla-açık gün. */
export const POST = withApiHandler(async ({ ctx, body }) => {
  const result = await setDayOverrideTool(ctx, body);
  return fromServiceResult(result);
});
