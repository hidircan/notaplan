/**
 * PRODUCT_BACKLOG §6 Faz 1 — evrak şablon + örnek (JSON parity; DB when STORE_MODE=db).
 */

import path from "path";
import { isDbMode, resolveDataDir } from "../config";
import { uid } from "../utils";
import { buildDocumentReference } from "../document-reference";
import { sanitizeTemplateHtml } from "../document-sanitize";
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
    version: 1,
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
          version: 1,
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
  createdById?: string | null;
  version?: number | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentTemplate {
  return {
    id: t.id,
    kind: t.kind as DocumentTemplateKind,
    name: t.name,
    bodyHtml: t.bodyHtml,
    active: t.active,
    createdById: t.createdById ?? undefined,
    version: t.version ?? 1,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export type CreateTemplateInput = {
  tenantId: string;
  kind: DocumentTemplateKind;
  name: string;
  bodyHtml: string;
  createdById: string;
};

/** Yönetici tarafından yeni şablon — bodyHtml sanitize edilerek yazılır (XSS savunması). */
export async function createTemplate(input: CreateTemplateInput): Promise<DocumentTemplate> {
  const now = new Date().toISOString();
  const safeBody = sanitizeTemplateHtml(input.bodyHtml);
  const row: StoredTpl = {
    id: uid("dtpl"),
    tenantId: input.tenantId,
    kind: input.kind,
    name: input.name,
    bodyHtml: safeBody,
    active: true,
    createdById: input.createdById,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  if (isDbMode) {
    const { prisma } = await import("../db");
    await prisma.documentTemplate.create({
      data: {
        id: row.id,
        tenantId: row.tenantId,
        kind: row.kind,
        name: row.name,
        bodyHtml: row.bodyHtml,
        active: true,
        createdById: input.createdById,
        version: 1,
      },
    });
  } else {
    const all = await loadTpl();
    await saveTpl([...all, row]);
  }
  return publicTpl(row);
}

export type UpdateTemplateInput = {
  name?: string;
  bodyHtml?: string;
};

/** Yönetici tarafından şablon düzenleme — `bodyHtml` verilirse yeniden sanitize edilir, `version` +1 olur. */
export async function updateTemplate(
  tenantId: string,
  id: string,
  patch: UpdateTemplateInput
): Promise<DocumentTemplate | null> {
  const now = new Date().toISOString();
  const safeBody = patch.bodyHtml !== undefined ? sanitizeTemplateHtml(patch.bodyHtml) : undefined;
  if (isDbMode) {
    const { prisma } = await import("../db");
    const existing = await prisma.documentTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    const row = await prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(safeBody !== undefined ? { bodyHtml: safeBody } : {}),
        version: existing.version + 1,
      },
    });
    return mapTplDb(row);
  }
  const all = await loadTpl();
  const idx = all.findIndex((t) => t.id === id && t.tenantId === tenantId);
  if (idx === -1) return null;
  const updated: StoredTpl = {
    ...all[idx],
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(safeBody !== undefined ? { bodyHtml: safeBody } : {}),
    version: (all[idx].version ?? 1) + 1,
    updatedAt: now,
  };
  const next = [...all];
  next[idx] = updated;
  await saveTpl(next);
  return publicTpl(updated);
}

/** Silme yok — arşivleme `active:false` yapar (DocumentInstance ile aynı "soft" desen). */
export async function archiveTemplate(tenantId: string, id: string, active: boolean): Promise<DocumentTemplate | null> {
  if (isDbMode) {
    const { prisma } = await import("../db");
    const existing = await prisma.documentTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    const row = await prisma.documentTemplate.update({ where: { id }, data: { active } });
    return mapTplDb(row);
  }
  const all = await loadTpl();
  const idx = all.findIndex((t) => t.id === id && t.tenantId === tenantId);
  if (idx === -1) return null;
  const updated: StoredTpl = { ...all[idx], active, updatedAt: new Date().toISOString() };
  const next = [...all];
  next[idx] = updated;
  await saveTpl(next);
  return publicTpl(updated);
}

/** Yönetim ekranı için — arşivlenmiş DAHİL tüm şablonlar (listTemplates yalnız aktifleri döner). */
export async function listAllTemplates(tenantId: string): Promise<DocumentTemplate[]> {
  await ensureDefaultTemplates(tenantId);
  if (isDbMode) {
    const { prisma } = await import("../db");
    const rows = await prisma.documentTemplate.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
    return rows.map(mapTplDb);
  }
  const all = await loadTpl();
  return all
    .filter((t) => t.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicTpl);
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * `{{key}}` VEYA `{{namespace.key}}` (ör. `{{student.fullName}}`) —
 * `fields` düz bir Record olduğu için nokta dahil TÜM anahtar aynen
 * `fields["student.fullName"]` olarak aranır (çağıran taraf — tools.ts
 * createDocumentInstanceTool — hem eski düz anahtarları hem yeni
 * namespace'li anahtarları AYNI `fields` objesinde birlikte doldurur).
 * Bulunamayan HER placeholder için boş string döner — asla hata fırlatmaz
 * (kural: eksik veri güvenli/boş davranır).
 *
 * GÜVENLİK: değerler HTML-ESCAPE edilerek enjekte edilir — şablonun
 * KENDİSİ (`bodyHtml`) sanitize edilse bile, alan değerleri (ör. yönetici
 * tarafından serbest metin olarak girilen `freeText`) ham HTML olarak
 * yazılırsa ikinci bir XSS yolu açardı. `renderedHtml` sonradan
 * `dangerouslySetInnerHTML` ile gösterilip yazdırıldığı için bu kritik.
 */
export function renderTemplate(bodyHtml: string, fields: Record<string, string>): string {
  return bodyHtml.replace(/\{\{([\w.]+)\}\}/g, (_, key: string) => escapeHtml(fields[key] ?? ""));
}

/**
 * Aynı `reference` tenant içinde ZATEN varsa (istatistiksel olarak imkansıza
 * yakın ama `instanceId` çakışması dışında da tetiklenebilir — ör. aynı
 * kind+yıl kombinasyonunda hash çakışması) yeni bir `id` ile tekrar dener.
 * DB modunda gerçek `@@unique([tenantId, reference])` ihlali (P2002) da
 * aynı şekilde yeniden denemeyi tetikler — çift kayıt asla DB'ye yazılmaz.
 */
const REFERENCE_COLLISION_MAX_RETRY = 3;

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
  const tpl = await getTemplate(input.tenantId, input.templateId);
  const body = tpl?.bodyHtml ?? input.fieldValues.__bodyHtml ?? "";
  const now = new Date().toISOString();
  const year = new Date(now).getFullYear();

  for (let attempt = 0; attempt < REFERENCE_COLLISION_MAX_RETRY; attempt++) {
    const id = uid("doc");
    const reference = buildDocumentReference(input.kind, id, year);
    const renderedHtml = renderTemplate(body, {
      ...input.fieldValues,
      reference,
      "document.referenceNumber": reference,
      "document.createdAt": now,
    });
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
      try {
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
      } catch (e) {
        // Prisma P2002 = unique constraint ihlali (tenantId+reference) — yeniden dene.
        const isUniqueViolation = typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
        if (isUniqueViolation && attempt < REFERENCE_COLLISION_MAX_RETRY - 1) continue;
        throw e;
      }
    } else {
      const all = await loadInst();
      if (all.some((x) => x.tenantId === input.tenantId && x.reference === reference)) {
        if (attempt < REFERENCE_COLLISION_MAX_RETRY - 1) continue;
        throw new Error("Belge referans numarası çakışması — lütfen tekrar deneyin.");
      }
      all.push(row);
      await saveInst(all);
    }
    const { tenantId: _t, ...pub } = row;
    void _t;
    return pub;
  }
  // Buraya asla ulaşılmamalı (döngü içinde her zaman return/throw var) — TS için savunma.
  throw new Error("Belge oluşturulamadı.");
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
  fileSize?: number | null;
  signedUploadedAt?: Date | null;
  signedBy?: string | null;
  signedVersions?: unknown;
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
    fileSize: r.fileSize ?? undefined,
    signedUploadedAt: r.signedUploadedAt ? r.signedUploadedAt.toISOString() : undefined,
    signedBy: r.signedBy ?? undefined,
    signedVersions: (r.signedVersions as DocumentInstance["signedVersions"]) ?? undefined,
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
/**
 * Ham dosya baytını (`fileData`) YANITTAN ÇIKARIR — liste görünümü yalnızca
 * metadata'ya (fileName/fileMimeType/fileSize/signedUploadedAt) ihtiyaç
 * duyar; ham içerik yalnızca tekil `getDocumentInstance` (dosya indirme
 * rotasının okuduğu AYNI fonksiyon) üzerinden, sahiplik kontrolü geçtikten
 * sonra erişilebilir olmalı (kural E).
 */
function stripFileData(doc: DocumentInstance): DocumentInstance {
  const { fileData: _fd, ...rest } = doc;
  void _fd;
  return rest;
}

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
    return rows.map(mapDbInstance).map(stripFileData);
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
      return stripFileData(pub);
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

/**
 * İmzalı/taranmış sürüm yükleme — status "uploaded" olur, imzalayan sorumlu
 * ve zaman kaydedilir. ÖNCEKİ sürüm ÜZERİNE YAZILMAZ: `signedVersions`
 * geçmişine yeni bir metadata kaydı EKLENİR (append-only), yalnızca GÜNCEL
 * sürümün ham baytı `fileData`'da tutulur (kural E — "eskisini yok etmek
 * yerine sürüm geçmişinde tut; en güncel sürüm varsayılan indirilen olsun").
 */
export async function uploadSignedDocumentFile(
  tenantId: string,
  id: string,
  file: { fileName: string; fileMimeType: string; fileData: string; fileSize: number },
  uploadedBy: string
): Promise<DocumentInstance | null> {
  const now = new Date();
  const versionEntry = {
    id: uid("dver"),
    fileName: file.fileName,
    fileMimeType: file.fileMimeType,
    fileSize: file.fileSize,
    uploadedAt: now.toISOString(),
    uploadedBy,
  };
  if (isDbMode) {
    const { prisma } = await import("../db");
    const r = await prisma.documentInstance.findFirst({ where: { id, tenantId } });
    if (!r) return null;
    const existingVersions = Array.isArray(r.signedVersions) ? r.signedVersions : [];
    await prisma.documentInstance.update({
      where: { id },
      data: {
        status: "uploaded",
        fileName: file.fileName,
        fileMimeType: file.fileMimeType,
        fileData: file.fileData,
        fileSize: file.fileSize,
        signedUploadedAt: now,
        signedBy: uploadedBy,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signedVersions: [...existingVersions, versionEntry] as any,
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
    fileSize: file.fileSize,
    signedUploadedAt: now.toISOString(),
    signedBy: uploadedBy,
    signedVersions: [...(all[idx].signedVersions ?? []), versionEntry],
    updatedAt: now.toISOString(),
  };
  await saveInst(all);
  const { tenantId: _t, ...pub } = all[idx];
  void _t;
  return pub;
}

/**
 * İmzalı sürüm geçmişinden BİR kaydı soft-delete eder (audit izi kalır,
 * hard delete YOK — modül geneliyle aynı desen). Silinen kayıt GÜNCEL
 * (`fileData` ile eşleşen) sürümse, dosya alanları temizlenir ve durum
 * `sent_for_signature`'a geri döner — eski sürümlerin ham baytı zaten
 * saklanmadığı için (yalnızca metadata) otomatik bir öncekine "geri dönme"
 * YAPILAMAZ; yönetici yeniden yükler. Bu sınır kodda ve teslim raporunda
 * açıkça belirtilir.
 */
export async function softDeleteSignedVersion(
  tenantId: string,
  documentId: string,
  versionId: string
): Promise<DocumentInstance | null> {
  const now = new Date();
  const doc = await getDocumentInstance(tenantId, documentId);
  if (!doc) return null;
  const versions = doc.signedVersions ?? [];
  const versionIdx = versions.findIndex((v) => v.id === versionId && !v.deletedAt);
  if (versionIdx === -1) return null;
  const nextVersions = versions.map((v, i) => (i === versionIdx ? { ...v, deletedAt: now.toISOString() } : v));
  const wasCurrent = versions[versionIdx]!.fileName === doc.fileName && versions[versionIdx]!.uploadedAt === doc.signedUploadedAt;

  if (isDbMode) {
    const { prisma } = await import("../db");
    await prisma.documentInstance.update({
      where: { id: documentId },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signedVersions: nextVersions as any,
        ...(wasCurrent
          ? { status: "sent_for_signature", fileName: null, fileMimeType: null, fileData: null, fileSize: null }
          : {}),
      },
    });
    return getDocumentInstance(tenantId, documentId);
  }
  const all = await loadInst();
  const idx = all.findIndex((x) => x.id === documentId && x.tenantId === tenantId);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    signedVersions: nextVersions,
    updatedAt: now.toISOString(),
    ...(wasCurrent
      ? {
          status: "sent_for_signature" as DocumentInstanceStatus,
          fileName: undefined,
          fileMimeType: undefined,
          fileData: undefined,
          fileSize: undefined,
        }
      : {}),
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
    return rows.map(mapDbInstance).map(stripFileData);
  }
  const all = await loadInst();
  return all
    .filter((x) => x.tenantId === tenantId && x.studentId === studentId)
    .map(({ tenantId: _t, ...pub }) => {
      void _t;
      return stripFileData(pub);
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
