import type { AppData } from "../types";

/**
 * Şube eşlemesi kısa ad veya ada göre yapılır. Belirsiz veya bulunamayan
 * eşleşme asla tahmin edilmez — açık bir hata döner.
 */
export function resolveBranchId(
  data: AppData,
  value: string
): { ok: true; branchId: string } | { ok: false; message: string } {
  const v = value.trim().toLowerCase();
  if (!v) return { ok: false, message: "Şube bilgisi boş olamaz." };
  const matches = data.settings.branches.filter(
    (b) => b.shortName.trim().toLowerCase() === v || b.name.trim().toLowerCase() === v
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
  const v = value.trim().toLowerCase();
  if (!v) return { ok: false, message: "Öğretmen e-postası boş olamaz." };
  const matches = data.teachers.filter((t) => t.email.trim().toLowerCase() === v);
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
