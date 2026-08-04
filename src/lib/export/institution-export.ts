/**
 * Kurum verisi dışa aktarımı (EPIC 0, `IMPLEMENTATION_PLAN.md`). Saf
 * dönüşüm — hiçbir I/O yapmaz, `readData()`'nın ZATEN tenant-scoped
 * döndürdüğü `AppData`'yı CSV'ye çevirir. Bu yüzden export'un kendisi
 * "tenant-safe"tir; asıl izolasyon garantisi `readData()`'nın ALS/oturum
 * tabanlı kapsamlamasından gelir (bkz. `src/lib/store.ts`) — burada AYRICA
 * hiçbir tenantId filtresi/parametre alınmaz, alınamaz.
 */
import type { AppData } from "../types";

export type ExportEntity =
  | "students"
  | "teachers"
  | "lessons"
  | "attendances"
  | "payments"
  | "makeupRequests";

export const EXPORT_ENTITIES: ExportEntity[] = [
  "students",
  "teachers",
  "lessons",
  "attendances",
  "payments",
  "makeupRequests",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const header = columns.map(csvCell).join(",");
  const lines = rows.map((row) => columns.map((c) => csvCell(row[c])).join(","));
  return [header, ...lines].join("\r\n");
}

function branchName(data: AppData, branchId: string): string {
  return data.settings.branches.find((b) => b.id === branchId)?.name ?? branchId;
}

/**
 * `AppData` (zaten tek kuruma kapsamlanmış) → varlık adı → CSV içeriği.
 * Yalnızca `entities` içinde istenenler üretilir. Kayıt yoksa yine de
 * başlık satırı içeren boş bir CSV döner (boş durum, hata değil).
 */
export function buildInstitutionExport(
  data: AppData,
  entities: ExportEntity[]
): Record<ExportEntity, string> {
  const out = {} as Record<ExportEntity, string>;

  if (entities.includes("students")) {
    out.students = toCsv(
      [
        "id",
        "ad",
        "email",
        "telefon",
        "veliAdi",
        "veliTelefon",
        "sube",
        "enstrumanlar",
        "ogretmenId",
        "paket",
        "haftalikDersSayisi",
        "aylikUcret",
        "aktif",
        "notlar",
        "kayitTarihi",
      ],
      data.students.map((s) => ({
        id: s.id,
        ad: s.name,
        email: s.email,
        telefon: s.phone,
        veliAdi: s.parentName,
        veliTelefon: s.parentPhone,
        sube: branchName(data, s.branchId),
        enstrumanlar: s.instruments,
        ogretmenId: s.teacherId,
        paket: s.packageName,
        haftalikDersSayisi: s.weeklyLessonCount,
        aylikUcret: s.monthlyFee,
        aktif: s.active,
        notlar: s.notes,
        kayitTarihi: s.createdAt,
      }))
    );
  }

  if (entities.includes("teachers")) {
    out.teachers = toCsv(
      ["id", "ad", "email", "telefon", "sube", "enstrumanlar", "aktif"],
      data.teachers.map((t) => ({
        id: t.id,
        ad: t.name,
        email: t.email,
        telefon: t.phone,
        sube: branchName(data, t.branchId),
        enstrumanlar: t.instruments,
        aktif: t.active,
      }))
    );
  }

  if (entities.includes("lessons")) {
    out.lessons = toCsv(
      ["id", "ogrenciId", "ogretmenId", "sube", "enstruman", "baslangic", "bitis", "tip", "durum"],
      data.lessons.map((l) => ({
        id: l.id,
        ogrenciId: l.studentId,
        ogretmenId: l.teacherId,
        sube: branchName(data, l.branchId),
        enstruman: l.instrument,
        baslangic: l.startAt,
        bitis: l.endAt,
        tip: l.type,
        durum: l.status,
      }))
    );
  }

  if (entities.includes("attendances")) {
    out.attendances = toCsv(
      ["id", "dersId", "ogrenciId", "durum", "sebep", "isaretlenmeZamani"],
      data.attendances.map((a) => ({
        id: a.id,
        dersId: a.lessonId,
        ogrenciId: a.studentId,
        durum: a.status,
        sebep: a.reason,
        isaretlenmeZamani: a.markedAt,
      }))
    );
  }

  if (entities.includes("payments")) {
    out.payments = toCsv(
      ["id", "ogrenciId", "tutar", "odenenTutar", "durum", "vadeTarihi", "odemeTarihi", "aciklama"],
      data.payments.map((p) => ({
        id: p.id,
        ogrenciId: p.studentId,
        tutar: p.amount,
        odenenTutar: p.paidAmount,
        durum: p.status,
        vadeTarihi: p.dueDate,
        odemeTarihi: p.paidAt,
        aciklama: p.description,
      }))
    );
  }

  if (entities.includes("makeupRequests")) {
    out.makeupRequests = toCsv(
      [
        "id",
        "olusturmaTarihi",
        "ogrenci",
        "veli",
        "anaOgretmen",
        "sube",
        "enstruman",
        "sebep",
        "durum",
        "slaSonTarihi",
        "slaSeviyesi",
        "kararNotu",
        "kararVeren",
        "kararTarihi",
        "sonKullanimTarihi",
        "onaylananDersId",
      ],
      data.makeupRequests.map((m) => {
        const student = data.students.find((s) => s.id === m.studentId);
        const teacher = data.teachers.find((t) => t.id === m.teacherId);
        return {
          id: m.id,
          olusturmaTarihi: m.createdAt,
          ogrenci: student?.name ?? m.studentId,
          veli: student?.parentName ?? "",
          anaOgretmen: teacher?.name ?? m.teacherId,
          sube: branchName(data, m.branchId),
          enstruman: m.instrument,
          sebep: m.reason,
          durum: m.status,
          slaSonTarihi: m.slaDeadline ?? "",
          slaSeviyesi: m.slaEscalationLevel ?? 0,
          kararNotu: m.decisionNote ?? "",
          kararVeren: m.decidedBy ?? "",
          kararTarihi: m.decidedAt ?? "",
          sonKullanimTarihi: m.expiresAt,
          onaylananDersId: m.confirmedLessonId,
        };
      })
    );
  }

  return out;
}
