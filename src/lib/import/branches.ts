import type { CsvRecord } from "./csv";
import type { ImportPreview, ImportRowError, ImportReadRow } from "./types";
import { IMPORT_READ_ROWS_PREVIEW_LIMIT } from "./types";

export type BranchImportRow = {
  name: string;
  shortName: string;
  city: string;
  phone: string;
  address: string;
};

export const BRANCH_CSV_COLUMNS = ["ad", "kisa_ad", "sehir", "telefon", "adres"] as const;

export const BRANCH_CSV_SAMPLE = `ad,kisa_ad,sehir,telefon,adres
Bostanlı Şubesi,Bostanlı,İzmir,0555 000 0000,"Bostanlı Mah. Cemal Gürsel Cd. No:1"
`;

export function validateBranchRows(records: CsvRecord[]): ImportPreview<BranchImportRow> {
  const errors: ImportRowError[] = [];
  const valid: BranchImportRow[] = [];
  const readRows: ImportReadRow[] = [];
  const seenShortNames = new Set<string>();

  records.forEach((rec, idx) => {
    const row = idx + 2;
    const name = rec["ad"] ?? "";
    const shortName = rec["kisa_ad"] ?? "";
    const city = rec["sehir"] ?? "";
    const phone = rec["telefon"] ?? "";
    const address = rec["adres"] ?? "";

    if (readRows.length < IMPORT_READ_ROWS_PREVIEW_LIMIT) {
      readRows.push({
        row,
        summary: `${name || "(ad boş)"} — ${shortName || "(kısa ad boş)"} — ${city || "(şehir boş)"}`,
      });
    }

    if (!name) errors.push({ row, field: "ad", message: "Ad boş olamaz." });
    if (!shortName) errors.push({ row, field: "kisa_ad", message: "Kısa ad boş olamaz." });
    if (!city) errors.push({ row, field: "sehir", message: "Şehir boş olamaz." });
    if (!phone) errors.push({ row, field: "telefon", message: "Telefon boş olamaz." });
    if (!address) errors.push({ row, field: "adres", message: "Adres boş olamaz." });

    if (shortName) {
      const key = shortName.trim().toLowerCase();
      if (seenShortNames.has(key)) {
        errors.push({
          row,
          field: "kisa_ad",
          message: `Bu dosyada "${shortName}" kısa adı birden fazla kez kullanılmış.`,
        });
      }
      seenShortNames.add(key);
    }

    if (name && shortName && city && phone && address) {
      valid.push({ name, shortName, city, phone, address });
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
