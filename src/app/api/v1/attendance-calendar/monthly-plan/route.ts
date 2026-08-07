import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult } from "@/lib/api/http";
import { setMonthlyPlanAmountTool } from "@/lib/services/tools";

export const dynamic = "force-dynamic";

/** POST { studentId, month (yyyy-MM), amount } — idempotent aylık Tutar upsert. */
export const POST = withApiHandler(async ({ ctx, body }) => {
  const result = await setMonthlyPlanAmountTool(ctx, body);
  return fromServiceResult(result);
});
