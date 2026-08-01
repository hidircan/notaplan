/**
 * Bağımlılıksız, RFC4180 benzeri CSV satır ayrıştırıcı. Tırnaklı alan, alan
 * içi ayraç, kaçışlı tırnak (""), evrensel satır sonu (\n, \r\n, tek başına
 * \r — klasik Mac dışa aktarımları), UTF-8 BOM, Unicode NFC normalizasyonu
 * (Türkçe karakterlerin NFD/NFC farkından etkilenmemek için) ve virgül/
 * noktalı virgül ayraç otomatik algılama desteği içerir. Yeni bir paket
 * eklemeye gerek bırakmayacak kadar küçük ve saf.
 */
const BOM = String.fromCharCode(0xfeff);

function normalizeCsvText(text: string): string {
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  return withoutBom.normalize("NFC");
}

/**
 * Yalnızca ilk satıra (başlık) bakarak virgül mü noktalı virgül mü ayraç
 * olarak kullanılmış anlar. Türkçe/Avrupa yerel ayarlı Excel/Numbers
 * dışa aktarımları genelde noktalı virgül kullanır.
 */
function detectDelimiter(text: string): "," | ";" {
  const firstLineEnd = text.search(/\r\n|\r|\n/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseWithDelimiter(clean: string, delimiter: "," | ";"): string[][] {
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
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    // Evrensel satır sonu: \n, \r\n ve tek başına \r (klasik Mac) hepsi bir
    // satırı bitirir. \r'den hemen sonra \n geliyorsa (CRLF) o \n atlanır —
    // aksi halde CRLF iki satır sonu gibi sayılıp boş satır üretilirdi.
    if (ch === "\r") {
      pushRow();
      i += 1;
      if (clean[i] === "\n") i += 1;
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

export function parseCsv(text: string): string[][] {
  const clean = normalizeCsvText(text);
  const delimiter = detectDelimiter(clean);
  return parseWithDelimiter(clean, delimiter);
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
