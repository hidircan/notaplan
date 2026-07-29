import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult } from "@/lib/api/http";
import { listAiExecutions } from "@/lib/ai/metrics";

export const dynamic = "force-dynamic";

/** GET /api/v1/ai/logs — tenant-scoped AI execution log */
export const GET = withApiHandler(
  async ({ ctx, searchParams }) => {
    const limit = Number(searchParams.get("limit") || 100);
    const logs = await listAiExecutions({
      tenantId: ctx.tenantId,
      limit: Math.min(Math.max(limit, 1), 500),
    });
    return fromServiceResult({ ok: true, data: { logs } });
  },
  { permission: "tools:catalog" }
);
