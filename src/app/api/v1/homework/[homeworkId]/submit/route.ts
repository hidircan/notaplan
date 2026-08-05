import { withApiHandler } from "@/lib/api/handler";
import { submitHomeworkTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/homework/:homeworkId/submit — STUDENT, yalnızca kendi ödevi. */
export const POST = withApiHandler(
  async ({ ctx, params, body }) =>
    submitHomeworkTool(ctx, {
      ...(typeof body === "object" && body !== null ? body : {}),
      homeworkId: params.homeworkId,
    }),
  { permission: "homework:submit" }
);
