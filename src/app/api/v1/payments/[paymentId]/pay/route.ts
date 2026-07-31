import { withApiHandler } from "@/lib/api/handler";
import { createPaymentTool } from "@/lib/services";
import { readData } from "@/lib/store";
import { markPaymentCasesPaid } from "@/lib/tahsilat/cases";

export const dynamic = "force-dynamic";

/** POST /api/v1/payments/:paymentId/pay — closes linked AI follow-up cases for ROI. */
export const POST = withApiHandler(
  async ({ ctx, params }) => {
    const result = await createPaymentTool(ctx, { paymentId: params.paymentId });
    if (result.ok) {
      const data = await readData();
      const payment = data.payments.find((item) => item.id === params.paymentId);
      if (payment) {
        await markPaymentCasesPaid({
          tenantId: ctx.tenantId,
          paymentId: payment.id,
          amount: Number(payment.amount),
        });
      }
    }
    return result;
  },
  { permission: "payments:write" }
);
