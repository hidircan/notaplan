import type { AppData } from "../types";

/**
 * Unicode NFC'ye normalize edip küçük harfe çevirir. Türkçe karakterler
 * (ör. "ı", "ş", "ğ") bazı uygulamalarda NFD (ayrıştırılmış) biçimde
 * kaydedilir; normalize edilmeden yapılan karşılaştırma görsel olarak aynı
 * görünen ama kod noktası düzeyinde farklı iki string'i eşleştiremez.
 */
function normalizeKey(value: string): string {
  return value.trim().normalize("NFC").toLowerCase();
}

/**
 * Şube eşlemesi kısa ad veya ada göre yapılır. Belirsiz veya bulunamayan
 * eşleşme asla tahmin edilmez — açık bir hata döner.
 */
export function resolveBranchId(
  data: AppData,
  value: string
): { ok: true; branchId: string } | { ok: false; message: string } {
  const v = normalizeKey(value);
  if (!v) return { ok: false, message: "Şube bilgisi boş olamaz." };
  const matches = data.settings.branches.filter(
    (b) => normalizeKey(b.shortName) === v || normalizeKey(b.name) === v
  );
  if (matches.length === 0) {
    return { ok: false, message: `"${value}" adında/kısa adında bir şube bulunamadı.` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      message: `"${value}" birden fazla şubeyle eşleşiyor — lütfen tam şube adını kullanın.`,
    };
  }
  return { ok: true, branchId: matches[0].id };
}

/**
 * Öğretmen eşlemesi yalnızca e-postaya göre yapılır. Belirsiz/bulunamayan
 * eşleşme tahmin edilmez.
 */
export function resolveTeacherIdByEmail(
  data: AppData,
  value: string
): { ok: true; teacherId: string } | { ok: false; message: string } {
  const v = normalizeKey(value);
  if (!v) return { ok: false, message: "Öğretmen e-postası boş olamaz." };
  const matches = data.teachers.filter((t) => normalizeKey(t.email) === v);
  if (matches.length === 0) {
    return { ok: false, message: `"${value}" e-postalı bir öğretmen bulunamadı.` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      message: `"${value}" e-postası birden fazla öğretmenle eşleşiyor.`,
    };
  }
  return { ok: true, teacherId: matches[0].id };
}
