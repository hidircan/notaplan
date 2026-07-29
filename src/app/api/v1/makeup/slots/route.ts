import { withApiHandler } from "@/lib/api/handler";
import { findAvailableSlotsTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/makeup/slots */
export const POST = withApiHandler(
  async ({ ctx, body }) => findAvailableSlotsTool(ctx, body),
  { permission: "makeup:read" }
);
