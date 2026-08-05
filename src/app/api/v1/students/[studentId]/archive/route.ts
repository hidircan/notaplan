import { withApiHandler } from "@/lib/api/handler";
import { archiveStudentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ ctx, body, params }) => {
    const archived =
      typeof body === "object" && body !== null && "archived" in body
        ? Boolean((body as { archived: unknown }).archived)
        : true;
    return archiveStudentTool(ctx, { studentId: params.studentId, archived });
  },
  { permission: "students:write" }
);
