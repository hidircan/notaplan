/**
 * PRODUCT_BACKLOG §6 Faz 1 — evrak şablon + örnek (JSON parity; DB when STORE_MODE=db).
 */

import path from "path";
import { isDbMode, resolveDataDir } from "../config";
import { uid } from "../utils";
import { buildDocumentReference } from "../document-reference";
import type {
  DocumentInstance,
  DocumentInstanceStatus,
  DocumentTemplate,
  DocumentTemplateKind,
} from "../types";

const TPL_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "document-templates.json");
const INST_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "document-instances.json");

export const DOCUMENT_TEMPLATES_FILE = TPL_FILE;
export const DOCUMENT_INSTANCES_FILE = INST_FILE;

type StoredTpl = DocumentTemplate & { tenantId: string };
type StoredInst = DocumentInstance & { tenantId: string };

async function loadTpl(): Promise<StoredTpl[]> {
  try {
    const fs = await import("fs/promises");
    return JSON.parse(await fs.readFile(TPL_FILE, "utf8")) as StoredTpl[];
  } catch {
    return [];
  }
}
async function saveTpl(rows: StoredTpl[]) {
  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(TPL_FILE), { recursive: true });
  await fs.writeFile(TPL_FILE, JSON.stringify(rows, null, 2));
}
async function loadInst(): Promise<StoredInst[]> {
  try {
    const fs = await import("fs/promises");
    return JSON.parse(await fs.readFile(INST_FILE, "utf8")) as StoredInst[];
  } catch {
    return [];
  }
}
async function saveInst(rows: StoredInst[]) {
  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(INST_FILE), { recursive: true });
  await fs.writeFile(INST_FILE, JSON.stringify(rows, null, 2));
}

const DEFAULT_BODIES: Partial<Record<DocumentTemplateKind, string>> = {
  student_enrollment_contract: `<h1>Öğrenci Kayıt Sözleşmesi</h1>
<p>Referans: {{reference}}</p>
<p>Öğrenci: {{studentName}} · Şube: {{branchName}} · Tarih: {{date}}</p>
<p>Metod: {{educationMethod}} · Kayıt: {{enrollmentDate}}</p>
<p>Ödeme: {{paymentPlan}}</p>
<p>{{freeText}}</p>`,
  parent_social_media_consent: `<h1>Sosyal Medya İzin Belgesi</h1>
<p>Referans: {{reference}} · Tarih: {{date}}</p>
<p>Öğrenci: {{studentName}} · Veli: {{parentName}}</p>
<p>Kapsam: {{scopes}}</p>`,
  kvkk: `<h1>KVKK Aydınlatma</h1><p>Referans: {{reference}} · {{studentName}} · {{date}}</p>`,
  trial_form: `<h1>Deneme Dersi Formu</h1><p>{{name}} · {{phone}} · {{date}} · {{reference}}</p>`,
};

export async function ensureDefaultTemplates(tenantId: string): Promise<DocumentTemplate[]> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const existing = await prisma.documentTemplate.findMany({ where: { tenantId } });
    if (existing.length > 0) {
      return existing.map(mapTplDb);
    }
  } else {
    const all = await loadTpl();
    const mine = all.filter((t) => t.tenantId === tenantId);
    if (mine.length > 0) return mine.map(publicTpl);
  }

  const now = new Date().toISOString();
  const created: StoredTpl[] = (
    Object.entries(DEFAULT_BODIES) as [DocumentTemplateKind, string][]
  ).map(([kind, bodyHtml]) => ({
    id: uid("dtpl"),
    tenantId,
    kind,
    name: documentKindLabel(kind),
    bodyHtml,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));

  if (isDbMode) {
    const { prisma } = await import("../db");
    for (const t of created) {
      await prisma.documentTemplate.create({
        data: {
          id: t.id,
          tenantId,
          kind: t.kind,
          name: t.name,
          bodyHtml: t.bodyHtml,
          active: true,
        },
      });
    }
  } else {
    const all = await loadTpl();
    await saveTpl([...all, ...created]);
  }
  return created.map(publicTpl);
}

function publicTpl(t: StoredTpl): DocumentTemplate {
  const { tenantId: _x, ...rest } = t;
  void _x;
  return rest;
}

function mapTplDb(t: {
  id: string;
  kind: string;
  name: string;
  bodyHtml: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DocumentTemplate {
  return {
    id: t.id,
    kind: t.kind as DocumentTemplateKind,
    name: t.name,
    bodyHtml: t.bodyHtml,
    active: t.active,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const KIND_LABELS: Record<DocumentTemplateKind, string> = {
  student_enrollment_contract: "Öğrenci Kayıt Sözleşmesi",
  parent_social_media_consent: "Veli / Sosyal Medya İzni",
  kvkk: "KVKK",
  teacher_contract: "Öğretmen Sözleşmesi",
  teacher_info_form: "Öğretmen Bilgi Formu",
  trial_form: "Deneme Formu",
  makeup_request: "Telafi Talebi",
  payment_commitment: "Ödeme Taahhüdü",
  petition: "Dilekçe",
  custom: "Özel Şablon",
};

export function documentKindLabel(kind: DocumentTemplateKind): string {
  return KIND_LABELS[kind] ?? kind;
}

export function renderTemplate(bodyHtml: string, fields: Record<string, string>): string {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key: string) => fields[key] ?? "");
}

export async function createDocumentInstance(input: {
  tenantId: string;
  templateId: string;
  kind: DocumentTemplateKind;
  fieldValues: Record<string, string>;
  studentId?: string;
  teacherId?: string;
  trialLessonId?: string;
  branchId?: string;
  createdBy: string;
}): Promise<DocumentInstance> {
  const id = uid("doc");
  const reference = buildDocumentReference(input.kind, id);
  const tpl = await getTemplate(input.tenantId, input.templateId);
  const body = tpl?.bodyHtml ?? input.fieldValues.__bodyHtml ?? "";
  const renderedHtml = renderTemplate(body, { ...input.fieldValues, reference });
  const now = new Date().toISOString();
  const row: StoredInst = {
    id,
    tenantId: input.tenantId,
    templateId: input.templateId,
    kind: input.kind,
    reference,
    status: "draft",
    studentId: input.studentId,
    teacherId: input.teacherId,
    trialLessonId: input.trialLessonId,
    branchId: input.branchId,
    fieldValues: input.fieldValues,
    renderedHtml,
    printCount: 0,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  if (isDbMode) {
    const { prisma } = await import("../db");
    await prisma.documentInstance.create({
      data: {
        id: row.id,
        tenantId: input.tenantId,
        templateId: row.templateId,
        kind: row.kind,
        reference: row.reference,
        status: row.status,
        studentId: row.studentId,
        teacherId: row.teacherId,
        trialLessonId: row.trialLessonId,
        branchId: row.branchId,
        fieldValues: row.fieldValues,
        renderedHtml: row.renderedHtml,
        printCount: 0,
        createdBy: row.createdBy,
      },
    });
  } else {
    const all = await loadInst();
    all.push(row);
    await saveInst(all);
  }
  const { tenantId: _t, ...pub } = row;
  void _t;
  return pub;
}

type DbInstanceRow = {
  id: string;
  templateId: string;
  kind: string;
  reference: string;
  status: string;
  studentId: string | null;
  teacherId: string | null;
  trialLessonId: string | null;
  branchId: string | null;
  fieldValues: unknown;
  renderedHtml: string | null;
  printCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileData?: string | null;
  signedUploadedAt?: Date | null;
};

function mapDbInstance(r: DbInstanceRow): DocumentInstance {
  return {
    id: r.id,
    templateId: r.templateId,
    kind: r.kind as DocumentTemplateKind,
    reference: r.reference,
    status: r.status as DocumentInstanceStatus,
    studentId: r.studentId ?? undefined,
    teacherId: r.teacherId ?? undefined,
    trialLessonId: r.trialLessonId ?? undefined,
    branchId: r.branchId ?? undefined,
    fieldValues: r.fieldValues as Record<string, string>,
    renderedHtml: r.renderedHtml ?? undefined,
    printCount: r.printCount,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    fileName: r.fileName ?? undefined,
    fileMimeType: r.fileMimeType ?? undefined,
    fileData: r.fileData ?? undefined,
    signedUploadedAt: r.signedUploadedAt ? r.signedUploadedAt.toISOString() : undefined,
  };
}

export async function getDocumentInstance(
  tenantId: string,
  id: string
): Promise<DocumentInstance | null> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const r = await prisma.documentInstance.findFirst({ where: { id, tenantId } });
    if (!r) return null;
    return mapDbInstance(r);
  }
  const all = await loadInst();
  const r = all.find((x) => x.id === id && x.tenantId === tenantId);
  if (!r) return null;
  const { tenantId: _t, ...pub } = r;
  void _t;
  return pub;
}

export type DocumentInstanceFilters = {
  kind?: DocumentTemplateKind;
  status?: DocumentInstanceStatus;
  studentId?: string;
  teacherId?: string;
  branchId?: string;
  reference?: string;
};

/** Evraklar Merkezi ana tablosu — kurumun TÜM evrak örnekleri, isteğe bağlı filtrelerle. */
export async function listDocumentInstances(
  tenantId: string,
  filters: DocumentInstanceFilters = {}
): Promise<DocumentInstance[]> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const rows = await prisma.documentInstance.findMany({
      where: {
        tenantId,
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.reference
          ? { reference: { contains: filters.reference } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDbInstance);
  }
  const all = await loadInst();
  return all
    .filter((x) => x.tenantId === tenantId)
    .filter((x) => !filters.kind || x.kind === filters.kind)
    .filter((x) => !filters.status || x.status === filters.status)
    .filter((x) => !filters.studentId || x.studentId === filters.studentId)
    .filter((x) => !filters.teacherId || x.teacherId === filters.teacherId)
    .filter((x) => !filters.branchId || x.branchId === filters.branchId)
    .filter((x) => !filters.reference || x.reference.toLowerCase().includes(filters.reference.toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ tenantId: _t, ...pub }) => {
      void _t;
      return pub;
    });
}

/** Silme yok — arşivleme "cancelled" durumuna geçirir (Faz 2 durum listesiyle aynı anlam). */
export async function archiveDocumentInstance(
  tenantId: string,
  id: string
): Promise<DocumentInstance | null> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const r = await prisma.documentInstance.findFirst({ where: { id, tenantId } });
    if (!r) return null;
    await prisma.documentInstance.update({ where: { id }, data: { status: "cancelled" } });
    return getDocumentInstance(tenantId, id);
  }
  const all = await loadInst();
  const idx = all.findIndex((x) => x.id === id && x.tenantId === tenantId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status: "cancelled", updatedAt: new Date().toISOString() };
  await saveInst(all);
  const { tenantId: _t, ...pub } = all[idx];
  void _t;
  return pub;
}

/** İmzalı/taranmış sürüm yükleme — status "uploaded" olur. */
export async function uploadSignedDocumentFile(
  tenantId: string,
  id: string,
  file: { fileName: string; fileMimeType: string; fileData: string }
): Promise<DocumentInstance | null> {
  const now = new Date();
  if (isDbMode) {
    const { prisma } = await import("../db");
    const r = await prisma.documentInstance.findFirst({ where: { id, tenantId } });
    if (!r) return null;
    await prisma.documentInstance.update({
      where: { id },
      data: {
        status: "uploaded",
        fileName: file.fileName,
        fileMimeType: file.fileMimeType,
        fileData: file.fileData,
        signedUploadedAt: now,
      },
    });
    return getDocumentInstance(tenantId, id);
  }
  const all = await loadInst();
  const idx = all.findIndex((x) => x.id === id && x.tenantId === tenantId);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    status: "uploaded",
    fileName: file.fileName,
    fileMimeType: file.fileMimeType,
    fileData: file.fileData,
    signedUploadedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await saveInst(all);
  const { tenantId: _t, ...pub } = all[idx];
  void _t;
  return pub;
}

/** Yeniden basım: aynı referans, printCount++ */
export async function markDocumentPrinted(
  tenantId: string,
  id: string
): Promise<DocumentInstance | null> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const r = await prisma.documentInstance.findFirst({ where: { id, tenantId } });
    if (!r) return null;
    const u = await prisma.documentInstance.update({
      where: { id },
      data: { status: "printed", printCount: r.printCount + 1 },
    });
    return getDocumentInstance(tenantId, u.id);
  }
  const all = await loadInst();
  const idx = all.findIndex((x) => x.id === id && x.tenantId === tenantId);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    status: "printed",
    printCount: all[idx].printCount + 1,
    updatedAt: new Date().toISOString(),
  };
  await saveInst(all);
  const { tenantId: _t, ...pub } = all[idx];
  void _t;
  return pub;
}

export async function listDocumentsForStudent(
  tenantId: string,
  studentId: string
): Promise<DocumentInstance[]> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const rows = await prisma.documentInstance.findMany({
      where: { tenantId, studentId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDbInstance);
  }
  const all = await loadInst();
  return all
    .filter((x) => x.tenantId === tenantId && x.studentId === studentId)
    .map(({ tenantId: _t, ...pub }) => {
      void _t;
      return pub;
    });
}

export async function listTemplates(tenantId: string): Promise<DocumentTemplate[]> {
  await ensureDefaultTemplates(tenantId);
  if (isDbMode) {
    const { prisma } = await import("../db");
    const rows = await prisma.documentTemplate.findMany({ where: { tenantId, active: true } });
    return rows.map(mapTplDb);
  }
  const all = await loadTpl();
  return all.filter((t) => t.tenantId === tenantId && t.active).map(publicTpl);
}

export async function getTemplate(
  tenantId: string,
  id: string
): Promise<DocumentTemplate | null> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const r = await prisma.documentTemplate.findFirst({ where: { id, tenantId } });
    return r ? mapTplDb(r) : null;
  }
  const all = await loadTpl();
  const t = all.find((x) => x.id === id && x.tenantId === tenantId);
  return t ? publicTpl(t) : null;
}
