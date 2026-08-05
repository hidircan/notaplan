import { withApiHandler } from "@/lib/api/handler";
import { updateTrialLessonStatusTool } from "@/lib/services";

export const dynamic = "force-dynamic";

export const PATCH = withApiHandler(
  async ({ ctx, body, params }) =>
    updateTrialLessonStatusTool(ctx, {
      ...(typeof body === "object" && body !== null ? (body as object) : {}),
      trialId: params.trialId,
    }),
  { permission: "trials:write" }
);
