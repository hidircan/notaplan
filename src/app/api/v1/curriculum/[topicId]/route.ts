import { withApiHandler } from "@/lib/api/handler";
import { updateCurriculumTopicTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/curriculum/:topicId — TEACHER kendi konusu. */
export const PATCH = withApiHandler(
  async ({ ctx, body, params }) =>
    updateCurriculumTopicTool(ctx, { ...body, topicId: params.topicId }),
  { permission: "curriculum:write" }
);
