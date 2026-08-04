import { withApiHandler } from "@/lib/api/handler";
import { createAnnouncementTool, listAnnouncementsForUserTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/announcements — çağıranın hedef kitlesinde olan, yayındaki duyurular. */
export const GET = withApiHandler(
  async ({ ctx }) => listAnnouncementsForUserTool(ctx),
  { permission: "announcements:read" }
);

/** POST /api/v1/announcements — yeni duyuru oluşturur (SCHOOL_ADMIN/SUPER_ADMIN). */
export const POST = withApiHandler(
  async ({ ctx, body }) => createAnnouncementTool(ctx, body),
  { permission: "announcements:write" }
);
