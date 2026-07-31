/**
 * Tahsilat Agent — vaka durum takibi.
 * Durumlar: draft → approved → sent → replied → paid | lost
 * STORE_MODE=db  → Prisma PaymentFollowUpCase (kalıcı, production)
 * STORE_MODE=json → dosya tabanlı store (demo)
 */

import path from "path";
import { isDbMode, resolveDataDir } from "../config";
import type { PaymentFollowUpCase as DbFollowUpCase } from "@prisma/client";

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

function toIso(date: Date | null): string | undefined {
  return date ? date.toISOString() : undefined;
}

function mapDbCase(c: DbFollowUpCase): FollowUpCase {
  return {
    id: c.id,
    tenantId: c.tenantId,
    paymentId: c.paymentId,
    studentId: c.studentId,
    status: c.status as FollowUpStatus,
    messageDraft: c.messageDraft,
    approvedBy: c.approvedBy ?? undefined,
    approvedAt: toIso(c.approvedAt),
    sentAt: toIso(c.sentAt),
    resolvedAt: toIso(c.resolvedAt),
    attributedAmount: c.attributedAmount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function listFollowUpCasesDb(tenantId: string): Promise<FollowUpCase[]> {
  const { prisma } = await import("../db");
  const rows = await prisma.paymentFollowUpCase.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapDbCase);
}

async function upsertFollowUpCaseDb(
  partial: Omit<FollowUpCase, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<FollowUpCase> {
  const { prisma } = await import("../db");
  const now = new Date();
  const data = {
    paymentId: partial.paymentId,
    studentId: partial.studentId,
    status: partial.status,
    messageDraft: partial.messageDraft,
    approvedBy: partial.approvedBy ?? null,
    approvedAt: partial.approvedAt ? new Date(partial.approvedAt) : null,
    sentAt: partial.sentAt ? new Date(partial.sentAt) : null,
    resolvedAt: partial.resolvedAt ? new Date(partial.resolvedAt) : null,
    attributedAmount: partial.attributedAmount,
  };
  const id = partial.id ?? `case_${crypto.randomUUID().slice(0, 8)}`;
  const existing = partial.id
    ? await prisma.paymentFollowUpCase.findFirst({
        where: { id, tenantId: partial.tenantId },
      })
    : null;
  if (existing) {
    const row = await prisma.paymentFollowUpCase.update({
      where: { id: existing.id },
      data,
    });
    return mapDbCase(row);
  }
  const row = await prisma.paymentFollowUpCase.create({
    data: { ...data, id, tenantId: partial.tenantId, createdAt: now },
  });
  return mapDbCase(row);
}

async function markPaymentCasesPaidDb(args: {
  tenantId: string;
  paymentId: string;
  amount: number;
}): Promise<FollowUpCase[]> {
  const { prisma } = await import("../db");
  const now = new Date();
  const open = await prisma.paymentFollowUpCase.findMany({
    where: {
      tenantId: args.tenantId,
      paymentId: args.paymentId,
      status: { notIn: ["paid", "lost"] },
    },
  });
  if (open.length === 0) return [];
  await prisma.paymentFollowUpCase.updateMany({
    where: {
      tenantId: args.tenantId,
      paymentId: args.paymentId,
      status: { notIn: ["paid", "lost"] },
    },
    data: { status: "paid", resolvedAt: now, attributedAmount: args.amount },
  });
  return open.map((c) => ({
    ...mapDbCase(c),
    status: "paid" as const,
    resolvedAt: now.toISOString(),
    attributedAmount: args.amount,
    updatedAt: now.toISOString(),
  }));
}

export async function listFollowUpCases(tenantId: string): Promise<FollowUpCase[]> {
  if (isDbMode) return listFollowUpCasesDb(tenantId);
  return (await loadAll()).filter((c) => c.tenantId === tenantId);
}

export async function upsertFollowUpCase(
  partial: Omit<FollowUpCase, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<FollowUpCase> {
  if (isDbMode) return upsertFollowUpCaseDb(partial);
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
  if (isDbMode) return markPaymentCasesPaidDb(args);
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
