import { withApiHandler } from "@/lib/api/handler";
import { submitTeacherFeedbackTool, listTeacherFeedbackTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/teacher-feedback — PARENT/STUDENT kendi çocuğu/kendisi için. */
export const POST = withApiHandler(
  async ({ ctx, body }) => submitTeacherFeedbackTool(ctx, body),
  { permission: "teacher_feedback:submit" }
);

/** GET /api/v1/teacher-feedback?teacherId=... — yalnızca SCHOOL_ADMIN/SUPER_ADMIN. */
export const GET = withApiHandler(
  async ({ ctx, searchParams }) =>
    listTeacherFeedbackTool(ctx, { teacherId: searchParams.get("teacherId") || undefined }),
  { permission: "teacher_feedback:read" }
);
