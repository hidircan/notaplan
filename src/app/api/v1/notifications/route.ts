import { withApiHandler } from "@/lib/api/handler";
import { listNotificationsTool, markNotificationReadTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/notifications — yalnızca çağıranın kendi bildirimleri (userId veya studentId). */
export const GET = withApiHandler(
  async ({ ctx }) => listNotificationsTool(ctx),
  { permission: "notifications:read" }
);

/** POST /api/v1/notifications — body: { notificationId } — okundu işaretler. */
export const POST = withApiHandler(
  async ({ ctx, body }) => markNotificationReadTool(ctx, body),
  { permission: "notifications:read" }
);
