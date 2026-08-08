/**
 * Package D — öğretmen şube ataması + şube-bazlı müsaitlik. Saf fonksiyonlar
 * (I/O yok), aynı desen `lesson-ops.ts`/`packages.ts` gibi — hem sunucu
 * (validateLessonSlot, findAvailableTeachersTool) hem test tarafından
 * kullanılır, tek gerçek kaynak.
 */

import type { AvailabilityWindow, BranchId, Teacher } from "./types";

/**
 * Bir öğretmen verilen şubede fiilen ders veriyor mu? Birincil `branchId`
 * HER ZAMAN dahildir; `branchIds` ek atanmış şubeleri temsil eder.
 */
export function teacherServesBranch(
  teacher: Pick<Teacher, "branchId" | "branchIds">,
  branchId: BranchId
): boolean {
  if (teacher.branchId === branchId) return true;
  return (teacher.branchIds ?? []).includes(branchId);
}

/**
 * Bir şube için geçerli müsaitlik pencereleri — YALNIZ o şube için tanımlı
 * pencereler + `branchId` alanı hiç verilmemiş (legacy veya bilinçli
 * "tüm şubeler") pencereler. Başka bir şubeye özel pencereler ASLA sızmaz —
 * sessiz/örtük bir varsayılan eşleşme yoktur, kural burada TEK yerde,
 * açıkça tanımlıdır.
 */
export function availabilityForBranch(
  windows: AvailabilityWindow[],
  branchId: BranchId
): AvailabilityWindow[] {
  return windows.filter((w) => w.branchId === undefined || w.branchId === branchId);
}

/**
 * İşten ayrılmış (terminationDate geçmişte) veya pasif bir öğretmen,
 * planlama/uygun-öğretmen akışlarında ASLA aday olarak görünmemeli — hem
 * `active` bayrağı hem `terminationDate` birlikte değerlendirilir (yalnız
 * `active` flag'ine güvenmek, admin unutup flag'i güncellemediğinde
 * yanlışlıkla aktif gösterebilirdi).
 */
export function isTeacherSchedulable(
  teacher: Pick<Teacher, "active" | "terminationDate">,
  now: Date = new Date()
): boolean {
  if (!teacher.active) return false;
  if (teacher.terminationDate && new Date(teacher.terminationDate) <= now) return false;
  return true;
}

/** Bir öğretmenin atanmış TÜM şubeleri (birincil dahil, tekrarsız). */
export function allAssignedBranches(teacher: Pick<Teacher, "branchId" | "branchIds">): BranchId[] {
  return Array.from(new Set([teacher.branchId, ...(teacher.branchIds ?? [])]));
}
