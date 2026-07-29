import { withApiHandler } from "@/lib/api/handler";
import { TOOL_CATALOG } from "@/lib/services";
import { ok } from "@/lib/services/result";

export const dynamic = "force-dynamic";

/** GET /api/v1/tools — AI / MCP tool catalog */
export const GET = withApiHandler(
  async () => ok({ tools: TOOL_CATALOG }),
  { permission: "tools:catalog" }
);
