import { z } from "zod";
import { withApiHandler } from "@/lib/api/handler";
import { fromServiceResult, jsonFail } from "@/lib/api/http";
import { listFollowUpCases, upsertFollowUpCase, getCollectionRoi } from "@/lib/tahsilat/cases";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ ctx }) => {
  const [cases, roi] = await Promise.all([
    listFollowUpCases(ctx.tenantId),
    getCollectionRoi(ctx.tenantId),
  ]);
  return fromServiceResult({ ok: true as const, data: { cases, roi } });
});

const patchSchema = z
  .object({
    id: z.string().optional(),
    paymentId: z.string(),
    studentId: z.string(),
    status: z.enum(["draft", "approved", "sent", "replied", "paid", "lost"]),
    messageDraft: z.string().default(""),
    attributedAmount: z.number().default(0),
  })
  .strict();

export const POST = withApiHandler(async ({ ctx, body }) => {
  if (ctx.role === "PARENT") return jsonFail("FORBIDDEN", "Insufficient role");
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid payload");
  const now = new Date().toISOString();
  const record = await upsertFollowUpCase({
    ...parsed.data,
    tenantId: ctx.tenantId,
    approvedBy: parsed.data.status === "approved" ? ctx.userId : undefined,
    approvedAt: parsed.data.status === "approved" ? now : undefined,
    sentAt: parsed.data.status === "sent" ? now : undefined,
    resolvedAt:
      parsed.data.status === "paid" || parsed.data.status === "lost" ? now : undefined,
  });
  return fromServiceResult({ ok: true as const, data: record });
});
