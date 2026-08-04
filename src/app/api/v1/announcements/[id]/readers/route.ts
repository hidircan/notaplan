import { withApiHandler } from "@/lib/api/handler";
import { listAnnouncementReadersTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/announcements/:id/readers — yönetim ekranı "kim okudu" tablosu (admin). */
export const GET = withApiHandler(
  async ({ ctx, params }) => listAnnouncementReadersTool(ctx, { announcementId: params.id }),
  { permission: "announcements:write" }
);
