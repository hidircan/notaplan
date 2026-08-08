import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult } from "@/lib/api/http";
import { checkProviderHealth, checkAllProviderHealth } from "@/lib/ai/metrics";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/ai/health — `health`: active chat-orchestrator provider probe
 * (unchanged); `chain`: presence-only configured/model status for every
 * provider in `PROVIDER_CHAIN` (Sprint: Real Multi-Provider Runtime).
 */
export const GET = withApiHandler(
  async () => {
    const [health, chain] = await Promise.all([checkProviderHealth(), checkAllProviderHealth()]);
    return fromServiceResult({ ok: true, data: { health, chain } });
  },
  { permission: "tools:catalog" }
);
