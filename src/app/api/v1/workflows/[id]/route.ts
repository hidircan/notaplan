import { z } from "zod";
import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult, jsonFail } from "@/lib/api/http";
import {
  getWorkflowDefinition,
  runWorkflow,
  setWorkflowEnabled,
} from "@/lib/workflows";
import type { WorkflowId } from "@/lib/workflows";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  runNow: z.boolean().optional(),
});

/** PATCH /api/v1/workflows/:id — enable/disable or run now */
export const PATCH = withApiHandler(
  async ({ ctx, params, body }) => {
    const id = params.id as WorkflowId;
    if (!getWorkflowDefinition(id)) {
      return jsonFail("NOT_FOUND", `Unknown workflow: ${id}`);
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFail("VALIDATION_ERROR", "Invalid body", parsed.error.flatten());
    }

    let state = null;
    if (typeof parsed.data.enabled === "boolean") {
      state = await setWorkflowEnabled(id, parsed.data.enabled);
    }

    let run = null;
    if (parsed.data.runNow) {
      run = await runWorkflow(id, ctx.tenantId);
    }

    return fromServiceResult({
      ok: true,
      data: { id, state, run },
    });
  },
  { permission: "tools:catalog" }
);
