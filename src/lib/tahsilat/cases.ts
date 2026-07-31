/**
 * Tahsilat Agent — vaka durum takibi.
 * Durumlar: draft → approved → sent → replied → paid | lost
 * Dosya tabanlı store (demo); Prisma modeli production'a hazır (PaymentFollowUpCase).
 */

import path from "path";
import { resolveDataDir } from "../config";

export type FollowUpStatus = "draft" | "approved" | "sent" | "replied" | "paid" | "lost";

export type FollowUpCase = {
  id: string;
  tenantId: string;
  paymentId: string;
  studentId: string;
  status: FollowUpStatus;
  messageDraft: string;
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  resolvedAt?: string;
  attributedAmount: number;
  createdAt: string;
  updatedAt: string;
};

const FILE = path.join(
  resolveDataDir(path.join(process.cwd(), "data")),
  "tahsilat-cases.json"
);

/** Resolved store path — exposed so tests clean up the same file the module writes. */
export const FOLLOW_UP_CASES_FILE = FILE;

async function loadAll(): Promise<FollowUpCase[]> {
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as FollowUpCase[];
  } catch {
    return [];
  }
}

async function saveAll(cases: FollowUpCase[]): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(cases, null, 2));
}

export async function listFollowUpCases(tenantId: string): Promise<FollowUpCase[]> {
  return (await loadAll()).filter((c) => c.tenantId === tenantId);
}

export async function upsertFollowUpCase(
  partial: Omit<FollowUpCase, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<FollowUpCase> {
  const all = await loadAll();
  const now = new Date().toISOString();
  const existing = partial.id ? all.find((c) => c.id === partial.id) : undefined;
  const record: FollowUpCase = existing
    ? { ...existing, ...partial, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
    : {
        ...partial,
        id: `case_${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      };
  const next = existing ? all.map((c) => (c.id === record.id ? record : c)) : [...all, record];
  await saveAll(next);
  return record;
}

export async function markPaymentCasesPaid(args: {
  tenantId: string;
  paymentId: string;
  amount: number;
}): Promise<FollowUpCase[]> {
  const all = await loadAll();
  const now = new Date().toISOString();
  const updated: FollowUpCase[] = [];
  const next = all.map((record) => {
    if (
      record.tenantId === args.tenantId &&
      record.paymentId === args.paymentId &&
      record.status !== "paid" &&
      record.status !== "lost"
    ) {
      const closed = {
        ...record,
        status: "paid" as const,
        resolvedAt: now,
        attributedAmount: args.amount,
        updatedAt: now,
      };
      updated.push(closed);
      return closed;
    }
    return record;
  });
  if (updated.length) await saveAll(next);
  return updated;
}

/** Satış demosunun kalbi: agent'ın bu ay tahsilata kattığı tutar. */
export async function getCollectionRoi(tenantId: string): Promise<{
  activeCases: number;
  resolvedThisMonth: number;
  attributedThisMonth: number;
}> {
  const cases = await listFollowUpCases(tenantId);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const resolved = cases.filter(
    (c) => c.status === "paid" && c.resolvedAt && new Date(c.resolvedAt) >= monthStart
  );
  return {
    activeCases: cases.filter((c) => c.status !== "paid" && c.status !== "lost").length,
    resolvedThisMonth: resolved.length,
    attributedThisMonth: resolved.reduce((s, c) => s + c.attributedAmount, 0),
  };
}
