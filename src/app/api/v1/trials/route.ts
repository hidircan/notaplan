import { withApiHandler } from "@/lib/api/handler";
import { createTrialLessonTool, listTrialLessonsTool } from "@/lib/services";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ ctx }) => listTrialLessonsTool(ctx), {
  permission: "trials:read",
});

export const POST = withApiHandler(async ({ ctx, body }) => createTrialLessonTool(ctx, body), {
  permission: "trials:write",
});
