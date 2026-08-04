/**
 * EPIC 9 (IMPLEMENTATION_PLAN.md) — öğretmen müsaitlik önerisi/onay akışı.
 * STORE_MODE=db  → Prisma TeacherAvailabilityRequest (kalıcı, production)
 * STORE_MODE=json/memory → dosya tabanlı store (demo)
 * Aynı desen: src/lib/announcements/index.ts, src/lib/assessment/index.ts.
 *
 * Bu modül yalnızca ÖNERİ kaydının yaşam döngüsünü tutar — onaylanan bir
 * öneriyi asıl `Teacher.availability` alanına UYGULAMAK bu modülün işi
 * değildir, tool katmanı (reviewTeacherAvailabilityRequestTool) onayladıktan
 * sonra ayrıca src/lib/store.ts'teki updateTeacherAvailability'yi çağırır.
 */

import path from "path";
import { isDbMode, resolveDataDir } from "./config";
import { uid } from "./utils";
import type { TeacherAvailabilityRequest as DbTeacherAvailabilityRequest } from "@prisma/client";
import type {
  AvailabilityWindow,
  TeacherAvailabilityRequest,
  TeacherAvailabilityRequestStatus,
} from "./types";

const FILE = path.join(
  resolveDataDir(path.join(process.cwd(), "data")),
  "teacher-availability-requests.json"
);

/** Resolved store path — exposed so tests clean up the same file this module writes. */
export const TEACHER_AVAILABILITY_REQUESTS_FILE = FILE;

type StoredRequest = TeacherAvailabilityRequest & { tenantId: string };

async function loadAll(): Promise<StoredRequest[]> {
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as StoredRequest[];
  } catch {
    return [];
  }
}

async function saveAll(rows: StoredRequest[]): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

function mapDbRequest(r: DbTeacherAvailabilityRequest): StoredRequest {
  return {
    id: r.id,
    tenantId: r.tenantId,
    teacherId: r.teacherId,
    proposedAvailability: r.proposedAvailability as unknown as AvailabilityWindow[],
    exceptions: r.exceptions ?? undefined,
    status: r.status as TeacherAvailabilityRequestStatus,
    reviewNote: r.reviewNote ?? undefined,
    reviewedBy: r.reviewedBy ?? undefined,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toPublic(r: StoredRequest): TeacherAvailabilityRequest {
  return {
    id: r.id,
    teacherId: r.teacherId,
    proposedAvailability: r.proposedAvailability,
    exceptions: r.exceptions,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export type CreateAvailabilityRequestInput = {
  tenantId: string;
  teacherId: string;
  proposedAvailability: AvailabilityWindow[];
  exceptions?: unknown;
};

async function createAvailabilityRequestDb(
  input: CreateAvailabilityRequestInput
): Promise<TeacherAvailabilityRequest> {
  const { prisma } = await import("./db");
  const row = await prisma.teacherAvailabilityRequest.create({
    data: {
      id: uid("avreq"),
      tenantId: input.tenantId,
      teacherId: input.teacherId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proposedAvailability: input.proposedAvailability as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exceptions: (input.exceptions ?? null) as any,
      status: "pending",
    },
  });
  return toPublic(mapDbRequest(row));
}

export async function createAvailabilityRequest(
  input: CreateAvailabilityRequestInput
): Promise<TeacherAvailabilityRequest> {
  if (isDbMode) return createAvailabilityRequestDb(input);
  const all = await loadAll();
  const now = new Date().toISOString();
  const record: StoredRequest = {
    id: uid("avreq"),
    tenantId: input.tenantId,
    teacherId: input.teacherId,
    proposedAvailability: input.proposedAvailability,
    exceptions: input.exceptions,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await saveAll([...all, record]);
  return toPublic(record);
}

async function listForTeacherDb(
  tenantId: string,
  teacherId: string
): Promise<TeacherAvailabilityRequest[]> {
  const { prisma } = await import("./db");
  const rows = await prisma.teacherAvailabilityRequest.findMany({
    where: { tenantId, teacherId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => toPublic(mapDbRequest(r)));
}

/** Bir öğretmenin kendi geçmiş/bekleyen önerileri — sıralı, en yeni önce. */
export async function listAvailabilityRequestsForTeacher(
  tenantId: string,
  teacherId: string
): Promise<TeacherAvailabilityRequest[]> {
  if (isDbMode) return listForTeacherDb(tenantId, teacherId);
  const all = await loadAll();
  return all
    .filter((r) => r.tenantId === tenantId && r.teacherId === teacherId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublic);
}

async function getRequestDb(
  tenantId: string,
  id: string
): Promise<TeacherAvailabilityRequest | null> {
  const { prisma } = await import("./db");
  const row = await prisma.teacherAvailabilityRequest.findFirst({ where: { id, tenantId } });
  return row ? toPublic(mapDbRequest(row)) : null;
}

export async function getAvailabilityRequest(
  tenantId: string,
  id: string
): Promise<TeacherAvailabilityRequest | null> {
  if (isDbMode) return getRequestDb(tenantId, id);
  const all = await loadAll();
  const found = all.find((r) => r.id === id && r.tenantId === tenantId);
  return found ? toPublic(found) : null;
}

export type ReviewAvailabilityRequestInput = {
  status: "approved" | "rejected";
  reviewNote?: string;
  reviewedBy: string;
};

/**
 * Yalnızca "pending" durumundaki bir öneri incelenebilir — zaten
 * onaylanmış/reddedilmiş bir öneriyi tekrar incelemek `null` döner
 * (idempotent hata, EPIC 8'in CONCURRENT_UPDATE deseniyle tutarlı).
 */
async function reviewDb(
  tenantId: string,
  id: string,
  input: ReviewAvailabilityRequestInput
): Promise<TeacherAvailabilityRequest | null> {
  const { prisma } = await import("./db");
  const result = await prisma.teacherAvailabilityRequest.updateMany({
    where: { id, tenantId, status: "pending" },
    data: {
      status: input.status,
      reviewNote: input.reviewNote ?? null,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
    },
  });
  if (result.count === 0) return null;
  const row = await prisma.teacherAvailabilityRequest.findFirst({ where: { id, tenantId } });
  return row ? toPublic(mapDbRequest(row)) : null;
}

export async function reviewAvailabilityRequest(
  tenantId: string,
  id: string,
  input: ReviewAvailabilityRequestInput
): Promise<TeacherAvailabilityRequest | null> {
  if (isDbMode) return reviewDb(tenantId, id, input);
  const all = await loadAll();
  const idx = all.findIndex((r) => r.id === id && r.tenantId === tenantId && r.status === "pending");
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const updated: StoredRequest = {
    ...all[idx],
    status: input.status,
    reviewNote: input.reviewNote,
    reviewedBy: input.reviewedBy,
    reviewedAt: now,
    updatedAt: now,
  };
  const next = [...all];
  next[idx] = updated;
  await saveAll(next);
  return toPublic(updated);
}

async function clearAvailabilityRequestsDb(tenantId: string): Promise<void> {
  const { prisma } = await import("./db");
  await prisma.teacherAvailabilityRequest.deleteMany({ where: { tenantId } });
}

/** Demo reset için — tenant'ın tüm müsaitlik önerilerini siler. */
export async function clearAvailabilityRequests(tenantId: string): Promise<void> {
  if (isDbMode) return clearAvailabilityRequestsDb(tenantId);
  const all = await loadAll();
  const remaining = all.filter((r) => r.tenantId !== tenantId);
  if (remaining.length !== all.length) await saveAll(remaining);
}
