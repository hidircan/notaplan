import { withApiHandler } from "@/lib/api/handler";
import { createMakeupLessonTool } from "@/lib/services";
import { resolveWriteScope } from "@/lib/institution/write-scope";
import { runWithTenantAsync } from "@/lib/tenant-context";
import { auditLog } from "@/lib/auth/audit";
import { uid } from "@/lib/utils";
import { jsonFail } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** POST /api/v1/makeup/create */
export const POST = withApiHandler(
  async ({ ctx, body }) => {
    const writeScope = await resolveWriteScope(ctx);
    if (writeScope.mode !== "single") {
      auditLog({
        action: "makeup.create",
        requestId: uid("audit"),
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        role: ctx.role,
        outcome: "denied",
        meta: { scopeMode: writeScope.mode },
      });
      return jsonFail("FORBIDDEN", writeScope.reason);
    }
    const scopedCtx = { ...ctx, tenantId: writeScope.tenantId };
    const result = await runWithTenantAsync(writeScope.tenantId, () =>
      createMakeupLessonTool(scopedCtx, body)
    );
    auditLog({
      action: "makeup.create",
      requestId: uid("audit"),
      userId: ctx.userId,
      tenantId: writeScope.tenantId,
      role: ctx.role,
      outcome: result.ok ? "success" : "error",
      meta: { scopeMode: "single" },
    });
    return result;
  },
  { permission: "makeup:write" }
);
