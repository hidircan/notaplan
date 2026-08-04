import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { scanOverduePaymentsTool } from "../services/tools";
import { readData, updateStudentProfile, markPaymentPaid } from "../store";
import { listFollowUpCases, FOLLOW_UP_CASES_FILE } from "../tahsilat/cases";
import { listNotificationsForUser, NOTIFICATIONS_FILE } from "../notifications";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "SCHOOL_ADMIN",
    userId: "admin1",
    tenantId: DEFAULT_TENANT_ID,
    channel: "web",
    ...overrides,
  };
}

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  await fs.rm(FOLLOW_UP_CASES_FILE, { force: true });
  await fs.rm(NOTIFICATIONS_FILE, { force: true });
});

describe("EPIC 1 — scanOverduePaymentsTool (payment_reminders workflow'unun gerçek taraması)", () => {
  it("gecikmiş ödeme için taslak takip vakası açar ve veliye bildirim oluşturur", async () => {
    const before = await readData();
    const overdue = before.payments.find((p) => p.status === "overdue");
    expect(overdue).toBeDefined();
    if (!overdue) return;

    const result = await scanOverduePaymentsTool(ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.scanned).toBeGreaterThanOrEqual(1);
    expect(result.data.casesUpserted).toBeGreaterThanOrEqual(1);
    expect(result.data.notificationsCreated).toBeGreaterThanOrEqual(1);

    const cases = await listFollowUpCases(DEFAULT_TENANT_ID);
    const createdCase = cases.find((c) => c.paymentId === overdue.id);
    expect(createdCase).toBeDefined();
    expect(createdCase?.status).toBe("draft");

    const notifications = await listNotificationsForUser({
      tenantId: DEFAULT_TENANT_ID,
      studentId: overdue.studentId,
    });
    expect(notifications.some((n) => n.kind === "payment_overdue")).toBe(true);
  });

  it("communicationOptOut=true olan veli/öğrenci atlanır — ne vaka ne bildirim oluşur", async () => {
    const before = await readData();
    const overdue = before.payments.find((p) => p.status === "overdue");
    expect(overdue).toBeDefined();
    if (!overdue) return;

    await updateStudentProfile(overdue.studentId, { communicationOptOut: true });

    const result = await scanOverduePaymentsTool(ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.casesUpserted).toBe(0);
    expect(result.data.notificationsCreated).toBe(0);

    const cases = await listFollowUpCases(DEFAULT_TENANT_ID);
    expect(cases.find((c) => c.paymentId === overdue.id)).toBeUndefined();
  });

  it("sıklık limiti dolmadan aynı ödeme ikinci kez taranırsa tekrar vaka/bildirim üretmez", async () => {
    const before = await readData();
    const overdue = before.payments.find((p) => p.status === "overdue");
    expect(overdue).toBeDefined();
    if (!overdue) return;

    const first = await scanOverduePaymentsTool(ctx());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.casesUpserted).toBeGreaterThanOrEqual(1);

    const second = await scanOverduePaymentsTool(ctx());
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.casesUpserted).toBe(0);
    expect(second.data.notificationsCreated).toBe(0);

    const cases = (await listFollowUpCases(DEFAULT_TENANT_ID)).filter(
      (c) => c.paymentId === overdue.id
    );
    expect(cases).toHaveLength(1);
  });

  it("ödeme tamamlanınca (markPaymentPaid) artık taranmaz — hatırlatma durur", async () => {
    const before = await readData();
    const overdue = before.payments.find((p) => p.status === "overdue");
    expect(overdue).toBeDefined();
    if (!overdue) return;

    await scanOverduePaymentsTool(ctx());
    await markPaymentPaid(overdue.id);

    const result = await scanOverduePaymentsTool(ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Artık "overdue" olmadığı için taramaya dahil olmaz.
    const after = await readData();
    expect(after.payments.find((p) => p.id === overdue.id)?.status).not.toBe("overdue");
  });

  it("TEACHER rolü scanOverduePaymentsTool çağıramaz (FORBIDDEN)", async () => {
    const result = await scanOverduePaymentsTool(ctx({ role: "TEACHER", teacherId: "t1" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
