import type { AppData, Instrument } from "../types";
import { INSTRUMENTS } from "../types";
import type { CsvRecord } from "./csv";
import type { ImportPreview, ImportRowError, ImportReadRow } from "./types";
import { IMPORT_READ_ROWS_PREVIEW_LIMIT } from "./types";
import { resolveBranchId } from "./branch-lookup";

export type TeacherImportRow = {
  name: string;
  email: string;
  phone: string;
  branchId: string;
  instrument: Instrument;
};

export const TEACHER_CSV_COLUMNS = ["ad", "eposta", "telefon", "sube", "enstruman"] as const;

export const TEACHER_CSV_SAMPLE = `ad,eposta,telefon,sube,enstruman
Selin Kara,selin@okul.com,0555 111 1111,Erzene,Piyano
`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isInstrument(value: string): value is Instrument {
  return (INSTRUMENTS as string[]).includes(value);
}

/**
 * Öğretmen CSV'sinde e-posta zorunludur — hem içe aktarımın kendi
 * tekrar-önleme anahtarı hem de öğrenci satırlarının öğretmen eşleme
 * anahtarı budur (genel web formunda e-posta opsiyoneldir; toplu içe
 * aktarımda bilinçli olarak zorunlu tutulur).
 */
export function validateTeacherRows(data: AppData, records: CsvRecord[]): ImportPreview<TeacherImportRow> {
  const errors: ImportRowError[] = [];
  const valid: TeacherImportRow[] = [];
  const readRows: ImportReadRow[] = [];
  const seenEmails = new Set<string>();

  records.forEach((rec, idx) => {
    const row = idx + 2;
    const name = rec["ad"] ?? "";
    const email = rec["eposta"] ?? "";
    const phone = rec["telefon"] ?? "";
    const branchValue = rec["sube"] ?? "";
    const instrumentValue = rec["enstruman"] ?? "";

    if (readRows.length < IMPORT_READ_ROWS_PREVIEW_LIMIT) {
      readRows.push({
        row,
        summary: `${name || "(ad boş)"} — ${branchValue || "(şube boş)"} — ${instrumentValue || "(enstrüman boş)"}`,
      });
    }

    if (!name) errors.push({ row, field: "ad", message: "Ad boş olamaz." });
    if (!email) {
      errors.push({ row, field: "eposta", message: "E-posta boş olamaz." });
    } else if (!EMAIL_RE.test(email)) {
      errors.push({ row, field: "eposta", message: "E-posta biçimi geçersiz." });
    } else {
      const key = email.trim().toLowerCase();
      if (seenEmails.has(key)) {
        errors.push({ row, field: "eposta", message: `Bu dosyada "${email}" birden fazla kez kullanılmış.` });
      }
      seenEmails.add(key);
    }
    if (!phone) errors.push({ row, field: "telefon", message: "Telefon boş olamaz." });

    let branchId: string | null = null;
    if (!branchValue) {
      errors.push({ row, field: "sube", message: "Şube boş olamaz." });
    } else {
      const resolved = resolveBranchId(data, branchValue);
      if (!resolved.ok) {
        errors.push({ row, field: "sube", message: resolved.message });
      } else {
        branchId = resolved.branchId;
      }
    }

    if (!instrumentValue) {
      errors.push({ row, field: "enstruman", message: "Enstrüman boş olamaz." });
    } else if (!isInstrument(instrumentValue)) {
      errors.push({
        row,
        field: "enstruman",
        message: `Geçersiz enstrüman: "${instrumentValue}". Geçerli değerler: ${INSTRUMENTS.join(", ")}.`,
      });
    }

    if (name && email && EMAIL_RE.test(email) && phone && branchId && isInstrument(instrumentValue)) {
      valid.push({ name, email, phone, branchId, instrument: instrumentValue });
    }
  });

  return {
    totalRows: records.length,
    validCount: valid.length,
    errorCount: errors.length,
    errors,
    valid,
    readRows,
  };
}
