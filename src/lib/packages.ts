/**
 * ÖNCELİK 4 (devam) — Paket Yönetimi. Saf veri dönüşümleri (store-agnostic),
 * aynı desen `lesson-series.ts`/`teacher-fee-rules` gibi: burada asla I/O
 * yok, yalnızca AppData -> AppData dönüşümü + doğrulama.
 */

import type { AppData, Package, PackageStatus, StudentTermType } from "./types";
import { uid } from "./utils";

export type PackageInput = {
  title: string;
  description?: string;
  price30Min: number;
  price40Min: number;
  price50Min: number;
  termLabel?: StudentTermType;
  createdBy: string;
};

export type PackageMutationResult =
  | { ok: true; data: AppData; pkg: Package }
  | { ok: false; message: string };

function validatePrices(input: Pick<PackageInput, "price30Min" | "price40Min" | "price50Min">): string | null {
  for (const [label, value] of [
    ["30 dk", input.price30Min],
    ["40 dk", input.price40Min],
    ["50 dk", input.price50Min],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      return `${label} fiyatı tam sayı (TL, kuruş yok) ve negatif olmayan bir değer olmalı.`;
    }
  }
  return null;
}

export function createPackageData(data: AppData, input: PackageInput, now: Date = new Date()): PackageMutationResult {
  if (!input.title.trim()) return { ok: false, message: "Paket başlığı boş olamaz." };
  const priceError = validatePrices(input);
  if (priceError) return { ok: false, message: priceError };

  const nowIso = now.toISOString();
  const pkg: Package = {
    id: uid("pkg"),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    status: "active",
    price30Min: input.price30Min,
    price40Min: input.price40Min,
    price50Min: input.price50Min,
    termLabel: input.termLabel,
    createdBy: input.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { ok: true, data: { ...data, packages: [...(data.packages ?? []), pkg] }, pkg };
}

export type PackagePatch = Partial<
  Pick<Package, "title" | "description" | "price30Min" | "price40Min" | "price50Min" | "termLabel" | "status">
>;

/**
 * Fiyat/açıklama/durum güncellenir — GEÇMİŞ Payment kayıtlarına asla
 * dokunmaz (Payment.amount oluşturma anında donmuş bir tam sayıdır, bu
 * fonksiyon yalnızca Package satırını değiştirir). Hard delete yok;
 * `status:"archived"` ile pasife alınır.
 */
export function updatePackageData(
  data: AppData,
  packageId: string,
  patch: PackagePatch,
  now: Date = new Date()
): PackageMutationResult {
  const existing = (data.packages ?? []).find((p) => p.id === packageId);
  if (!existing) return { ok: false, message: "Paket bulunamadı." };

  if (
    patch.price30Min !== undefined ||
    patch.price40Min !== undefined ||
    patch.price50Min !== undefined
  ) {
    const priceError = validatePrices({
      price30Min: patch.price30Min ?? existing.price30Min,
      price40Min: patch.price40Min ?? existing.price40Min,
      price50Min: patch.price50Min ?? existing.price50Min,
    });
    if (priceError) return { ok: false, message: priceError };
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, message: "Paket başlığı boş olamaz." };
  }
  if (patch.status !== undefined && patch.status !== "active" && patch.status !== "archived") {
    return { ok: false, message: "Geçersiz paket durumu." };
  }

  const updated: Package = {
    ...existing,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() : existing.title,
    updatedAt: now.toISOString(),
  };
  const packages = (data.packages ?? []).map((p) => (p.id === packageId ? updated : p));
  return { ok: true, data: { ...data, packages }, pkg: updated };
}

/** Yeni öğrenci kaydında seçilebilecek (aktif) paketler. */
export function activePackages(packages: Package[] | undefined): Package[] {
  return (packages ?? []).filter((p) => p.status === "active");
}

export function priceForDuration(pkg: Package, durationMinutes: 30 | 40 | 50): number {
  if (durationMinutes === 30) return pkg.price30Min;
  if (durationMinutes === 40) return pkg.price40Min;
  return pkg.price50Min;
}

export function packageStatusLabel(status: PackageStatus): string {
  return status === "archived" ? "Arşivlendi" : "Aktif";
}
