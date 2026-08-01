import type { AppData, Instrument } from "../types";
import { INSTRUMENTS } from "../types";
import type { CsvRecord } from "./csv";
import type { ImportPreview, ImportRowError } from "./types";
import { resolveBranchId, resolveTeacherIdByEmail } from "./branch-lookup";

export type StudentImportRow = {
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  branchId: string;
  instrument: Instrument;
  teacherId: string;
  packageName: string;
  weeklyLessonCount: number;
  monthlyFee: number;
  notes: string;
};

export const STUDENT_CSV_COLUMNS = [
  "ad",
  "eposta",
  "telefon",
  "veli_adi",
  "veli_telefon",
  "sube",
  "enstruman",
  "ogretmen_eposta",
  "paket_adi",
  "haftalik_ders_sayisi",
  "aylik_ucret",
  "notlar",
] as const;

export const STUDENT_CSV_SAMPLE = `ad,eposta,telefon,veli_adi,veli_telefon,sube,enstruman,ogretmen_eposta,paket_adi,haftalik_ders_sayisi,aylik_ucret,notlar
Deniz Ak,,0555 222 2222,Ayşe Ak,0555 222 2223,Erzene,Piyano,ogretmen@okulunuz.com,Bireysel Aylık — 4 ders,1,3000,
`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isInstrument(value: string): value is Instrument {
  return (INSTRUMENTS as string[]).includes(value);
}

export function validateStudentRows(data: AppData, records: CsvRecord[]): ImportPreview<StudentImportRow> {
  const errors: ImportRowError[] = [];
  const valid: StudentImportRow[] = [];
  const seenPhones = new Set<string>();

  records.forEach((rec, idx) => {
    const row = idx + 2;
    const name = rec["ad"] ?? "";
    const email = rec["eposta"] ?? "";
    const phone = rec["telefon"] ?? "";
    const parentName = rec["veli_adi"] ?? "";
    const parentPhone = rec["veli_telefon"] ?? "";
    const branchValue = rec["sube"] ?? "";
    const instrumentValue = rec["enstruman"] ?? "";
    const teacherEmailValue = rec["ogretmen_eposta"] ?? "";
    const packageName = rec["paket_adi"] ?? "";
    const weeklyRaw = rec["haftalik_ders_sayisi"] ?? "";
    const feeRaw = rec["aylik_ucret"] ?? "";
    const notes = rec["notlar"] ?? "";

    if (!name) errors.push({ row, field: "ad", message: "Ad boş olamaz." });
    if (email && !EMAIL_RE.test(email)) {
      errors.push({ row, field: "eposta", message: "E-posta biçimi geçersiz (boş bırakılabilir)." });
    }
    if (!phone) {
      errors.push({ row, field: "telefon", message: "Telefon boş olamaz." });
    } else {
      const key = phone.trim();
      if (seenPhones.has(key)) {
        errors.push({ row, field: "telefon", message: `Bu dosyada "${phone}" telefonu birden fazla kez kullanılmış.` });
      }
      seenPhones.add(key);
    }
    if (!parentName) errors.push({ row, field: "veli_adi", message: "Veli adı boş olamaz." });
    if (!parentPhone) errors.push({ row, field: "veli_telefon", message: "Veli telefonu boş olamaz." });

    let branchId: string | null = null;
    if (!branchValue) {
      errors.push({ row, field: "sube", message: "Şube boş olamaz." });
    } else {
      const resolved = resolveBranchId(data, branchValue);
      if (!resolved.ok) errors.push({ row, field: "sube", message: resolved.message });
      else branchId = resolved.branchId;
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

    let teacherId: string | null = null;
    if (!teacherEmailValue) {
      errors.push({ row, field: "ogretmen_eposta", message: "Öğretmen e-postası boş olamaz." });
    } else {
      const resolved = resolveTeacherIdByEmail(data, teacherEmailValue);
      if (!resolved.ok) errors.push({ row, field: "ogretmen_eposta", message: resolved.message });
      else teacherId = resolved.teacherId;
    }

    if (!packageName) errors.push({ row, field: "paket_adi", message: "Paket adı boş olamaz." });

    let weeklyLessonCount: number | null = null;
    if (!weeklyRaw) {
      errors.push({ row, field: "haftalik_ders_sayisi", message: "Haftalık ders sayısı boş olamaz." });
    } else {
      const n = Number(weeklyRaw);
      if (!Number.isInteger(n) || n < 1) {
        errors.push({
          row,
          field: "haftalik_ders_sayisi",
          message: `Geçerli bir tam sayı olmalı: "${weeklyRaw}".`,
        });
      } else {
        weeklyLessonCount = n;
      }
    }

    let monthlyFee: number | null = null;
    if (!feeRaw) {
      errors.push({ row, field: "aylik_ucret", message: "Aylık ücret boş olamaz." });
    } else {
      const n = Number(feeRaw);
      if (!Number.isInteger(n) || n < 0) {
        errors.push({ row, field: "aylik_ucret", message: `Geçerli bir tam sayı olmalı: "${feeRaw}".` });
      } else {
        monthlyFee = n;
      }
    }

    if (
      name &&
      (!email || EMAIL_RE.test(email)) &&
      phone &&
      parentName &&
      parentPhone &&
      branchId &&
      isInstrument(instrumentValue) &&
      teacherId &&
      packageName &&
      weeklyLessonCount !== null &&
      monthlyFee !== null
    ) {
      valid.push({
        name,
        email,
        phone,
        parentName,
        parentPhone,
        branchId,
        instrument: instrumentValue,
        teacherId,
        packageName,
        weeklyLessonCount,
        monthlyFee,
        notes,
      });
    }
  });

  return { totalRows: records.length, validCount: valid.length, errorCount: errors.length, errors, valid };
}
