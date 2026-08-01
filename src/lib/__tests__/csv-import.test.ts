import { describe, it, expect } from "vitest";
import { parseCsv, rowsToRecords } from "../import/csv";
import { validateBranchRows, BRANCH_CSV_SAMPLE } from "../import/branches";
import { validateTeacherRows, TEACHER_CSV_SAMPLE } from "../import/teachers";
import { validateRoomRows, ROOM_CSV_SAMPLE } from "../import/rooms";
import { validateStudentRows, STUDENT_CSV_SAMPLE } from "../import/students";
import { createSeedData } from "../seed";

describe("parseCsv", () => {
  it("düz virgüllü satırları ayrıştırır", () => {
    const rows = parseCsv("a,b,c\n1,2,3\n");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("tırnaklı alan içindeki virgülü korur", () => {
    const rows = parseCsv('ad,adres\nDeniz,"İzmir, Bornova"\n');
    expect(rows[1]).toEqual(["Deniz", "İzmir, Bornova"]);
  });

  it("kaçışlı tırnağı (\"\") tek tırnağa çevirir", () => {
    const rows = parseCsv('ad\n"Ali ""Rock"" Koç"\n');
    expect(rows[1]).toEqual(['Ali "Rock" Koç']);
  });

  it("Türkçe karakterleri bozmadan korur", () => {
    const rows = parseCsv("ad\nŞükrü Öztürk\n");
    expect(rows[1]).toEqual(["Şükrü Öztürk"]);
  });

  it("UTF-8 BOM'u temizler", () => {
    const bom = String.fromCharCode(0xfeff);
    const rows = parseCsv(`${bom}ad,sube\nDeniz,Erzene\n`);
    expect(rows[0]).toEqual(["ad", "sube"]);
  });

  it("son satırda yeni satır olmasa da son satırı kaybetmez", () => {
    const rows = parseCsv("a,b\n1,2");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("CRLF (\\r\\n) satır sonlarını doğru ayırır, boş satır üretmez", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("tek başına \\r (klasik Mac satır sonu) satırları birleştirmez — kök neden regresyonu", () => {
    // Bu, gerçek üretim hatasının kök nedeniydi: yalnızca \r kullanan bir
    // dosya tüm satırları TEK bir satıra birleştirip totalRows'u yanlış
    // (1 yerine 4 olması gerekirken) hesaplatıyordu.
    const rows = parseCsv("a,b\r1,2\r3,4\r");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("karışık satır sonlarını (CRLF + LF) doğru ayırır", () => {
    const rows = parseCsv("a,b\r\n1,2\n3,4\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("noktalı virgül ayraçlı (Excel/Numbers Türkçe yerel ayar) CSV'yi otomatik algılar", () => {
    const rows = parseCsv("ad;sube;enstruman\nDeniz;Erzene;Piyano\n");
    expect(rows).toEqual([
      ["ad", "sube", "enstruman"],
      ["Deniz", "Erzene", "Piyano"],
    ]);
  });

  it("noktalı virgül + CRLF + BOM birlikte doğru ayrıştırılır", () => {
    const bom = String.fromCharCode(0xfeff);
    const rows = parseCsv(`${bom}ad;sube\r\nDeniz;Erzene\r\n`);
    expect(rows).toEqual([
      ["ad", "sube"],
      ["Deniz", "Erzene"],
    ]);
  });

  it("telefon alanındaki boşlukları olduğu gibi korur (ayraç sanılmaz)", () => {
    const rows = parseCsv("ad,telefon\nDeniz,0533 618 5006\n");
    expect(rows[1]).toEqual(["Deniz", "0533 618 5006"]);
  });

  it("gerçek hata senaryosu: 4 satırlı öğretmen CSV'si tüm satır sonu biçimlerinde totalRows=4 üretir", () => {
    const header = "ad,eposta,telefon,sube,enstruman";
    const dataLines = [
      "Selin Kara,selin@okul.com,05551111111,Erzene,Piyano",
      "Hıdırcan Yağız,hidircanyagiz@gmail.com,05336185006,Bostanlı,Bağlama",
      "Ezgi Güçlü,ezguclu@gmail.com,05521800268,Bostanlı,Piyano",
      "Can Nevii,cannevii@gmail.com,05336185007,Bostanlı,Bağlama",
    ];
    for (const eol of ["\n", "\r\n", "\r"]) {
      const csv = [header, ...dataLines].join(eol) + eol;
      const { records } = rowsToRecords(parseCsv(csv));
      expect(records, `satır sonu ${JSON.stringify(eol)} için başarısız`).toHaveLength(4);
    }
  });
});

describe("validateBranchRows", () => {
  it("geçerli örnek CSV doğru sayıları verir", () => {
    const { records } = rowsToRecords(parseCsv(BRANCH_CSV_SAMPLE));
    const result = validateBranchRows(records);
    expect(result.totalRows).toBe(1);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(0);
  });

  it("eksik alanı satır numarasıyla reddeder", () => {
    const { records } = rowsToRecords(parseCsv("ad,kisa_ad,sehir,telefon,adres\n,Bostanlı,İzmir,0555,Adres\n"));
    const result = validateBranchRows(records);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2, field: "ad" });
    expect(result.validCount).toBe(0);
  });

  it("aynı dosyada tekrar eden kısa adı hata olarak işaretler", () => {
    const csv = "ad,kisa_ad,sehir,telefon,adres\nA,X,İzmir,0555,Adr\nB,X,İzmir,0555,Adr\n";
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateBranchRows(records);
    expect(result.errors.some((e) => e.field === "kisa_ad")).toBe(true);
  });
});

describe("validateTeacherRows", () => {
  const data = createSeedData();

  it("geçerli örnek CSV doğru sayıları verir", () => {
    const { records } = rowsToRecords(parseCsv(TEACHER_CSV_SAMPLE));
    const result = validateTeacherRows(data, records);
    expect(result.totalRows).toBe(1);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.valid[0].branchId).toBe("erzene");
  });

  it("geçersiz enstrümanı satır numarasıyla reddeder", () => {
    const csv = "ad,eposta,telefon,sube,enstruman\nAli,ali@x.com,0555,Erzene,Ukulele\n";
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateTeacherRows(data, records);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2, field: "enstruman" });
  });

  it("bulunamayan şubeyi reddeder", () => {
    const csv = "ad,eposta,telefon,sube,enstruman\nAli,ali@x.com,0555,Olmayan Şube,Piyano\n";
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateTeacherRows(data, records);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe("sube");
  });

  it("geçersiz e-posta biçimini reddeder", () => {
    const csv = "ad,eposta,telefon,sube,enstruman\nAli,gecersiz-eposta,0555,Erzene,Piyano\n";
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateTeacherRows(data, records);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe("eposta");
  });

  it("şube adı NFD (ayrıştırılmış Unicode) yazılmış olsa bile NFC şube kaydıyla eşleşir", () => {
    // "Bostanlı" -> "ı" harfi NFD biçiminde "i" + combining dot above olarak
    // kodlanmış olabilir (bazı editör/işletim sistemi kombinasyonlarında).
    const branchDataNfc = {
      ...data,
      settings: {
        ...data.settings,
        branches: [
          ...data.settings.branches,
          { id: "bostanli", name: "Bostanlı Şubesi", shortName: "Bostanlı".normalize("NFC"), address: "", phone: "", city: "" },
        ],
      },
    };
    const nfdShortName = "Bostanlı".normalize("NFD");
    const csv = `ad,eposta,telefon,sube,enstruman\nAli,ali@x.com,0555,${nfdShortName},Piyano\n`;
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateTeacherRows(branchDataNfc, records);
    expect(result.errorCount).toBe(0);
    expect(result.valid[0]?.branchId).toBe("bostanli");
  });

  it("okunan kayıtlar (readRows) her satır için Ad — Şube — Enstrüman özeti üretir, en fazla 10", () => {
    const csv =
      "ad,eposta,telefon,sube,enstruman\n" +
      "Selin Kara,selin@okul.com,0555,Erzene,Piyano\n" +
      "Ali Veli,ali@x.com,0556,Erzene,Gitar\n";
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateTeacherRows(data, records);
    expect(result.readRows).toEqual([
      { row: 2, summary: "Selin Kara — Erzene — Piyano" },
      { row: 3, summary: "Ali Veli — Erzene — Gitar" },
    ]);
  });
});

describe("validateRoomRows", () => {
  const data = createSeedData();

  it("geçerli örnek CSV doğru sayıları verir ve çoklu enstrümanı ayrıştırır", () => {
    const { records } = rowsToRecords(parseCsv(ROOM_CSV_SAMPLE));
    const result = validateRoomRows(data, records);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.valid[0].instruments).toEqual(["Keman", "Yan Flüt"]);
  });

  it("geçersiz kapasiteyi satır numarasıyla reddeder", () => {
    const csv = "ad,sube,kapasite,enstrumanlar\nOda,Erzene,abc,Piyano\n";
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateRoomRows(data, records);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2, field: "kapasite" });
  });
});

describe("validateStudentRows", () => {
  const data = createSeedData();
  const t1Email = data.teachers.find((t) => t.id === "t1")!.email;

  it("örnek CSV yapısı geçerli sütunlarla ayrıştırılır (şablon seed'e bağımlı değildir)", () => {
    const { header } = rowsToRecords(parseCsv(STUDENT_CSV_SAMPLE));
    expect(header).toContain("ogretmen_eposta");
    expect(header).toContain("eposta");
  });

  it("geçerli satır doğru sayıları verir (email boş olabilir)", () => {
    const csv =
      "ad,eposta,telefon,veli_adi,veli_telefon,sube,enstruman,ogretmen_eposta,paket_adi,haftalik_ders_sayisi,aylik_ucret,notlar\n" +
      `Deniz Ak,,0555 222 2222,Ayşe Ak,0555 222 2223,Erzene,Piyano,${t1Email},Bireysel Aylık — 4 ders,1,3000,\n`;
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateStudentRows(data, records);
    expect(result.totalRows).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBe(1);
    expect(result.valid[0].teacherId).toBe("t1");
  });

  it("belirsiz/bulunamayan öğretmen eşleşmesini satır numarasıyla reddeder", () => {
    const csv =
      "ad,eposta,telefon,veli_adi,veli_telefon,sube,enstruman,ogretmen_eposta,paket_adi,haftalik_ders_sayisi,aylik_ucret,notlar\n" +
      "Deniz,,0555,Veli,0556,Erzene,Piyano,olmayan@ogretmen.com,Paket,1,3000,\n";
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateStudentRows(data, records);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2, field: "ogretmen_eposta" });
  });

  it("hatalı tek satır bile tüm dosyayı geçersiz kılar (validCount sıfır kalmaz ama commit katmanı hiçbirini yazmaz)", () => {
    const csv =
      "ad,eposta,telefon,veli_adi,veli_telefon,sube,enstruman,ogretmen_eposta,paket_adi,haftalik_ders_sayisi,aylik_ucret,notlar\n" +
      `Deniz,,0555,Veli,0556,Erzene,Piyano,${t1Email},Paket,1,3000,\n` +
      `Ali,,0556,Veli2,0557,Erzene,Bateri-yanlis,${t1Email},Paket,1,3000,\n`;
    const { records } = rowsToRecords(parseCsv(csv));
    const result = validateStudentRows(data, records);
    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(1);
    // Commit katmanı errorCount > 0 olduğu sürece HİÇBİR kaydı yazmamalı —
    // bu kural store/action seviyesinde ayrıca test edilir.
  });
});
