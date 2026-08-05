/**
 * EPIC 6C (IMPLEMENTATION_PLAN.md) — veli/öğrencinin öğretmen hakkında
 * yapılandırılmış geri bildirimi. Aynı desen: src/lib/homework.ts,
 * src/lib/teacher-availability.ts.
 *
 * Gizlilik kararı (plan'ın "Gizlilik kararı" bölümü): kamuya açık ortalama/
 * sıralama YOK, öğretmen kendi geri bildirimini GÖRMEZ — bu modül yalnızca
 * SCHOOL_ADMIN/SUPER_ADMIN'e açık `listTeacherFeedbackTool` tarafından
 * okunur, öğretmene özel bir okuma yolu bilerek YAZILMADI.
 */

import path from "path";
import { isDbMode, resolveDataDir } from "./config";
import { uid } from "./utils";
import type { TeacherFeedback as DbTeacherFeedback } from "@prisma/client";
import type { TeacherFeedback, TeacherFeedbackStatus } from "./types";

const FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "teacher-feedback.json");
export const TEACHER_FEEDBACK_FILE_PATH = FILE;

type StoredFeedback = TeacherFeedback & { tenantId: string };

async function loadAll(): Promise<StoredFeedback[]> {
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as StoredFeedback[];
  } catch {
    return [];
  }
}

async function saveAll(rows: StoredFeedback[]): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

function mapDb(f: DbTeacherFeedback): StoredFeedback {
  return {
    id: f.id,
    tenantId: f.tenantId,
    teacherId: f.teacherId,
    studentId: f.studentId,
    submittedBy: f.submittedBy,
    submitterRole: f.submitterRole,
    scores: f.scores as Record<string, number>,
    comment: f.comment ?? undefined,
    status: f.status as TeacherFeedbackStatus,
    createdAt: f.createdAt.toISOString(),
  };
}

function toPublic(f: StoredFeedback): TeacherFeedback {
  return {
    id: f.id,
    teacherId: f.teacherId,
    studentId: f.studentId,
    submittedBy: f.submittedBy,
    submitterRole: f.submitterRole,
    scores: f.scores,
    comment: f.comment,
    status: f.status,
    createdAt: f.createdAt,
  };
}

export type SubmitTeacherFeedbackInput = {
  tenantId: string;
  teacherId: string;
  studentId: string;
  submittedBy: string;
  submitterRole: string;
  scores: Record<string, number>;
  comment?: string;
};

async function submitFeedbackDb(input: SubmitTeacherFeedbackInput): Promise<TeacherFeedback> {
  const { prisma } = await import("./db");
  const row = await prisma.teacherFeedback.create({
    data: {
      id: uid("tfb"),
      tenantId: input.tenantId,
      teacherId: input.teacherId,
      studentId: input.studentId,
      submittedBy: input.submittedBy,
      submitterRole: input.submitterRole,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scores: input.scores as any,
      comment: input.comment ?? null,
      status: "pending",
    },
  });
  return toPublic(mapDb(row));
}

export async function submitTeacherFeedback(
  input: SubmitTeacherFeedbackInput
): Promise<TeacherFeedback> {
  if (isDbMode) return submitFeedbackDb(input);
  const all = await loadAll();
  const record: StoredFeedback = {
    id: uid("tfb"),
    tenantId: input.tenantId,
    teacherId: input.teacherId,
    studentId: input.studentId,
    submittedBy: input.submittedBy,
    submitterRole: input.submitterRole,
    scores: input.scores,
    comment: input.comment,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await saveAll([...all, record]);
  return toPublic(record);
}

async function listForTeacherDb(tenantId: string, teacherId?: string): Promise<TeacherFeedback[]> {
  const { prisma } = await import("./db");
  const rows = await prisma.teacherFeedback.findMany({
    where: { tenantId, ...(teacherId ? { teacherId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => toPublic(mapDb(r)));
}

/** Yalnızca yönetim ekranı içindir (bkz. dosya başındaki gizlilik notu). */
export async function listTeacherFeedback(
  tenantId: string,
  teacherId?: string
): Promise<TeacherFeedback[]> {
  if (isDbMode) return listForTeacherDb(tenantId, teacherId);
  const all = await loadAll();
  return all
    .filter((f) => f.tenantId === tenantId && (!teacherId || f.teacherId === teacherId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublic);
}

async function clearFeedbackDb(tenantId: string): Promise<void> {
  const { prisma } = await import("./db");
  await prisma.teacherFeedback.deleteMany({ where: { tenantId } });
}

/** Demo reset için — tenant'ın tüm öğretmen geri bildirimlerini siler. */
export async function clearTeacherFeedback(tenantId: string): Promise<void> {
  if (isDbMode) return clearFeedbackDb(tenantId);
  const all = await loadAll();
  const remaining = all.filter((f) => f.tenantId !== tenantId);
  if (remaining.length !== all.length) await saveAll(remaining);
}
