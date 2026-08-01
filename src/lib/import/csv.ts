/**
 * Bağımlılıksız, RFC4180 benzeri CSV satır ayrıştırıcı. Tırnaklı alan, alan
 * içi virgül, kaçışlı tırnak (""), \r\n/\n satır sonu ve UTF-8 BOM desteği
 * içerir. Yeni bir paket eklemeye gerek bırakmayacak kadar küçük ve saf.
 */
const BOM = String.fromCharCode(0xfeff);

export function parseCsv(text: string): string[][] {
  const clean = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = clean.length;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export type CsvRecord = Record<string, string>;

/** İlk satırı başlık kabul eder, geri kalanını başlığa göre eşlenmiş kayıtlara çevirir. */
export function rowsToRecords(rows: string[][]): { header: string[]; records: CsvRecord[] } {
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const rec: CsvRecord = {};
    header.forEach((h, idx) => {
      rec[h] = (r[idx] ?? "").trim();
    });
    return rec;
  });
  return { header, records };
}
