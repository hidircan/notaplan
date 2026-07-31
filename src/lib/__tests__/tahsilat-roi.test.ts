import { describe, it, beforeEach } from "vitest";
import { expect } from "vitest";
import { promises as fs } from "fs";
import {
  listFollowUpCases,
  upsertFollowUpCase,
  getCollectionRoi,
  markPaymentCasesPaid,
  FOLLOW_UP_CASES_FILE,
} from "../tahsilat/cases";

beforeEach(async () => {
  await fs.rm(FOLLOW_UP_CASES_FILE, { force: true });
});

describe("tahsilat vaka takibi", () => {
  it("vaka oluşturur, durum ilerletir ve ödeme ile kapatır", async () => {
    const c = await upsertFollowUpCase({
      tenantId: "demo-tenant",
      paymentId: "p1",
      studentId: "s1",
      status: "draft",
      messageDraft: "hatırlatma",
      attributedAmount: 0,
    });
    expect((await listFollowUpCases("demo-tenant")).length).toBe(1);

    await upsertFollowUpCase({
      id: c.id,
      tenantId: "demo-tenant",
      paymentId: "p1",
      studentId: "s1",
      status: "sent",
      messageDraft: "hatırlatma",
      attributedAmount: 0,
    });
    await markPaymentCasesPaid({
      tenantId: "demo-tenant",
      paymentId: "p1",
      amount: 3000,
    });

    const roi = await getCollectionRoi("demo-tenant");
    expect(roi.resolvedThisMonth).toBe(1);
    expect(roi.attributedThisMonth).toBe(3000);
    expect(roi.activeCases).toBe(0);
  });

  it("tenant izolasyonu: başka tenant vakaları görmez", async () => {
    await upsertFollowUpCase({
      tenantId: "a",
      paymentId: "p1",
      studentId: "s1",
      status: "draft",
      messageDraft: "",
      attributedAmount: 0,
    });
    expect((await listFollowUpCases("b")).length).toBe(0);
  });

  it("markPaymentCasesPaid kapalı vakaları yeniden açmaz", async () => {
    await upsertFollowUpCase({
      tenantId: "demo-tenant",
      paymentId: "p1",
      studentId: "s1",
      status: "sent",
      messageDraft: "hatırlatma",
      attributedAmount: 0,
    });
    await markPaymentCasesPaid({
      tenantId: "demo-tenant",
      paymentId: "p1",
      amount: 3000,
    });
    const closed = await markPaymentCasesPaid({
      tenantId: "demo-tenant",
      paymentId: "p1",
      amount: 3000,
    });
    expect(closed.length).toBe(0);
    expect((await getCollectionRoi("demo-tenant")).resolvedThisMonth).toBe(1);
  });
});
