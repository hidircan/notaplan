import { withApiHandler } from "@/lib/api/handler";
import { markAnnouncementReadTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/announcements/:id/read — çağıranı bu duyuru için okundu işaretler. */
export const POST = withApiHandler(
  async ({ ctx, params }) => markAnnouncementReadTool(ctx, { announcementId: params.id }),
  { permission: "announcements:read" }
);
