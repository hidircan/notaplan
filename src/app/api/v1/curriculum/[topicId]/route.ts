import { withApiHandler } from "@/lib/api/handler";
import { updateCurriculumTopicTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/curriculum/:topicId — TEACHER kendi konusu. */
export const PATCH = withApiHandler(
  async ({ ctx, body, params }) => {
    const payload =
      typeof body === "object" && body !== null
        ? { ...(body as Record<string, unknown>), topicId: params.topicId }
        : { topicId: params.topicId };
    return updateCurriculumTopicTool(ctx, payload);
  },
  { permission: "curriculum:write" }
);
