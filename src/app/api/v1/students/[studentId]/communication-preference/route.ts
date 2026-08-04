import { withApiHandler } from "@/lib/api/handler";
import { updateCommunicationPreferenceTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/students/:studentId/communication-preference
 * body: { communicationOptOut: boolean }
 * Veli kendi çocuğu için, admin herkes için çağırabilir (tool katmanı RBAC'ı uygular).
 */
export const PATCH = withApiHandler(
  async ({ ctx, params, body }) =>
    updateCommunicationPreferenceTool(ctx, {
      ...(typeof body === "object" && body !== null ? body : {}),
      studentId: params.studentId,
    }),
  { permission: "communication:write" }
);
