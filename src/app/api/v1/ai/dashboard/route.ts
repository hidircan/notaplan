import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult } from "@/lib/api/http";
import { getAiDashboard, getProviderHealthMap } from "@/lib/ai/metrics";
import { describeActiveProvider } from "@/lib/ai/provider-factory";

export const dynamic = "force-dynamic";

/** GET /api/v1/ai/dashboard — metrics for admin AI ops */
export const GET = withApiHandler(
  async ({ ctx }) => {
    const dashboard = await getAiDashboard(ctx.tenantId);
    const health = await getProviderHealthMap();
    const active = describeActiveProvider();
    return fromServiceResult({
      ok: true,
      data: { dashboard, providerHealth: health, activeProvider: active },
    });
  },
  { permission: "tools:catalog" }
);
