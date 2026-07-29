import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult } from "@/lib/api/http";
import { checkProviderHealth } from "@/lib/ai/metrics";

export const dynamic = "force-dynamic";

/** GET /api/v1/ai/health — probe active LLM provider */
export const GET = withApiHandler(
  async () => {
    const health = await checkProviderHealth();
    return fromServiceResult({ ok: true, data: { health } });
  },
  { permission: "tools:catalog" }
);
