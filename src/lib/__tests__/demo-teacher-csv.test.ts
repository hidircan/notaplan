import { describe, it, expect } from "vitest";
import { parseTeacherCsvContent } from "../import/demo-teacher-csv";

const SAMPLE_CSV = `ad;eposta;telefon;sube;enstruman
Turgay Hoşbaş;1@mail.com;0545 341 09 19;Evka 3;Piyano
Olcay Özdemir;2@mail.com;0535 262 06 23;Evka 3;Gitar
Ebru Şirince;3@mail.com;0 507 361 78 90;Evka 3;Keman
`;

describe("parseTeacherCsvContent — Öğretmenler.csv (ad;eposta;telefon;sube;enstruman)", () => {
  it("başlık satırını atlar, her satırı doğru alanlara ayırır", () => {
    const rows = parseTeacherCsvContent(SAMPLE_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      name: "Turgay Hoşbaş",
      email: "1@mail.com",
      phone: "0545 341 09 19",
      branchName: "Evka 3",
      instrument: "Piyano",
    });
  });

  it("CRLF satır sonlarını ve boş satırları güvenle işler", () => {
    const rows = parseTeacherCsvContent(SAMPLE_CSV.replace(/\n/g, "\r\n") + "\r\n\r\n");
    expect(rows).toHaveLength(3);
  });

  it("yalnızca başlık satırı varsa boş liste döner", () => {
    expect(parseTeacherCsvContent("ad;eposta;telefon;sube;enstruman\n")).toEqual([]);
  });
});

describe("Demo CSV öğretmen seed — e-posta ile idempotenlik kuralı", () => {
  /** scripts/seed-demo-csv-teachers.ts'in "zaten var mı?" kontrolüyle aynı mantık — burada saf/izole test edilir. */
  function planCreations(csvTeachers: { email: string }[], existingEmails: string[]): string[] {
    const existing = new Set(existingEmails.map((e) => e.toLowerCase()));
    return csvTeachers.filter((t) => !existing.has(t.email.toLowerCase())).map((t) => t.email);
  }

  it("hiçbiri mevcut değilse tüm CSV satırları oluşturulacak listeye girer", () => {
    const rows = parseTeacherCsvContent(SAMPLE_CSV);
    expect(planCreations(rows, [])).toEqual(["1@mail.com", "2@mail.com", "3@mail.com"]);
  });

  it("aynı seed ikinci kez çalıştırıldığında (tüm e-postalar zaten var) hiçbir yeni satır planlanmaz — çoğalma yok", () => {
    const rows = parseTeacherCsvContent(SAMPLE_CSV);
    const existing = rows.map((r) => r.email);
    expect(planCreations(rows, existing)).toEqual([]);
  });

  it("e-posta karşılaştırması case-insensitive'dir", () => {
    const rows = parseTeacherCsvContent(SAMPLE_CSV);
    expect(planCreations(rows, ["1@MAIL.COM", "2@mail.com", "3@mail.com"])).toEqual([]);
  });
});
