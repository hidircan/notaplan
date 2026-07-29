import { withApiHandler } from "@/lib/api/handler";
import { createPaymentTool } from "@/lib/services";

export const dynamic = "force-dynamic";

/** POST /api/v1/payments/:paymentId/pay */
export const POST = withApiHandler(
  async ({ ctx, params }) =>
    createPaymentTool(ctx, { paymentId: params.paymentId }),
  { permission: "payments:write" }
);
