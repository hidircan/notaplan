import { withApiHandler } from "@/lib/api/handler";
import { setLessonOpsFlagTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/lessons/:lessonId/ops { flag: attended|processed|makeup } */
export const POST = withApiHandler(
  async ({ ctx, body, params }) =>
    setLessonOpsFlagTool(ctx, {
      ...(typeof body === "object" && body !== null ? (body as object) : {}),
      lessonId: params.lessonId,
    }),
  { permission: "attendance:write" }
);
