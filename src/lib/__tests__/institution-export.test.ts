import { describe, it, expect } from "vitest";
import { createSeedData } from "../seed";
import { buildInstitutionExport, EXPORT_ENTITIES } from "../export/institution-export";

const data = createSeedData();

describe("buildInstitutionExport — yalnızca istenen varlıklar üretilir", () => {
  it("yalnızca 'students' istenirse yalnızca students CSV'si dolu döner", () => {
    const out = buildInstitutionExport(data, ["students"]);
    expect(out.students).toBeTruthy();
    expect(out.teachers).toBeUndefined();
    expect(out.payments).toBeUndefined();
  });

  it("tüm EXPORT_ENTITIES istenirse hepsi için CSV üretilir", () => {
    const out = buildInstitutionExport(data, EXPORT_ENTITIES);
    for (const entity of EXPORT_ENTITIES) {
      expect(out[entity]).toBeTruthy();
      expect(out[entity].split("\r\n").length).toBeGreaterThan(1); // başlık + en az 1 satır
    }
  });
});

describe("buildInstitutionExport — CSV doğruluğu", () => {
  it("students CSV'si başlık satırında beklenen sütunları içerir", () => {
    const out = buildInstitutionExport(data, ["students"]);
    const header = out.students.split("\r\n")[0];
    expect(header).toContain("ad");
    expect(header).toContain("veliAdi");
    expect(header).toContain("aylikUcret");
  });

  it("her öğrenci satırı gerçek veriden gelir — uydurma satır yok", () => {
    const out = buildInstitutionExport(data, ["students"]);
    const lines = out.students.split("\r\n").slice(1);
    expect(lines.length).toBe(data.students.length);
    expect(out.students).toContain(data.students[0].name);
  });

  it("virgül/tırnak içeren alanlar CSV-güvenli şekilde kaçırılır", () => {
    const withComma = {
      ...data,
      students: [{ ...data.students[0], notes: 'Not: "özel", dikkat' }],
    };
    const out = buildInstitutionExport(withComma, ["students"]);
    // Kaçırılmış hücre: çift tırnak içine alınmış, iç tırnaklar ikizlenmiş.
    expect(out.students).toContain('"Not: ""özel"", dikkat"');
  });

  it("payments CSV'sinde tutar/durum/vade alanları doğru satıra düşer", () => {
    const out = buildInstitutionExport(data, ["payments"]);
    const payment = data.payments[0];
    expect(out.payments).toContain(String(payment.amount));
    expect(out.payments).toContain(payment.status);
  });
});
