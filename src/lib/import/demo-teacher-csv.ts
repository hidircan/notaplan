import type { Instrument } from "../types";

export type DemoCsvTeacher = {
  name: string;
  email: string;
  phone: string;
  branchName: string;
  instrument: Instrument;
};

/**
 * `Öğretmenler.csv` (ad;eposta;telefon;sube;enstruman) — noktalı virgülle
 * ayrılmış, ilk satır başlık. Saf fonksiyon (dosya G/Ç yok) — hem
 * `scripts/seed-demo-csv-teachers.ts` hem testler tarafından kullanılır.
 */
export function parseTeacherCsvContent(raw: string): DemoCsvTeacher[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [, ...rows] = lines;
  return rows.map((line) => {
    const [name, email, phone, branchName, instrument] = line.split(";").map((c) => c.trim());
    return { name: name!, email: email!, phone: phone!, branchName: branchName!, instrument: instrument as Instrument };
  });
}
