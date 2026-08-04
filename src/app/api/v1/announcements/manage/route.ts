import { withApiHandler } from "@/lib/api/handler";
import { listAllAnnouncementsTool, updateAnnouncementStatusTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/announcements/manage — durum fark etmeksizin tüm duyurular (yönetim ekranı). */
export const GET = withApiHandler(
  async ({ ctx }) => listAllAnnouncementsTool(ctx),
  { permission: "announcements:write" }
);

/** PATCH /api/v1/announcements/manage — body: { announcementId, status } — yayına al/arşivle. */
export const PATCH = withApiHandler(
  async ({ ctx, body }) => updateAnnouncementStatusTool(ctx, body),
  { permission: "announcements:write" }
);
