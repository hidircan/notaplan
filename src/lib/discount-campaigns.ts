/**
 * Paket 5 — yüzde tabanlı kampanya/indirim hesaplama yardımcıları. Saf
 * fonksiyonlar (store/tenant bağımlılığı yok) — unit test edilebilir.
 *
 * "Kardeş" ilişkisi veri modelinde ayrı bir alan olarak YOK; burada aynı
 * `Student.parentPhone`'a kayıtlı aktif öğrenci sayısı pratik vekil olarak
 * kullanılır. Bu bilinçli bir basitleştirme — gerçek bir aile/kardeş
 * modeli (ör. `familyId`) eklenmesi ayrı bir karardır.
 */
import type { AppData, DiscountCampaign, Student } from "./types";
import { uid } from "./utils";

/** Aynı veli telefonuna kayıtlı AKTİF öğrenci sayısı (kendisi dahil). */
export function countActiveHouseholdMembers(students: Student[], studentId: string): number {
  const student = students.find((s) => s.id === studentId);
  if (!student || !student.parentPhone?.trim()) return 1;
  return students.filter((s) => s.active && s.parentPhone === student.parentPhone).length;
}

function isWithinWindow(campaign: DiscountCampaign, now: Date): boolean {
  if (campaign.validFrom && now < new Date(campaign.validFrom)) return false;
  if (campaign.validTo && now > new Date(campaign.validTo)) return false;
  return true;
}

/** Bu şube/kurum kapsamında şu an geçerli, aktif bir "sibling" kampanyası var mı? */
export function findApplicableSiblingCampaign(
  campaigns: DiscountCampaign[],
  branchId: string | undefined,
  now: Date = new Date()
): DiscountCampaign | undefined {
  return campaigns.find(
    (c) => c.kind === "sibling" && c.active && (!c.branchId || c.branchId === branchId) && isWithinWindow(c, now)
  );
}

/** Yüzde indirim uygulanmış fiyat — TL, tam sayıya yuvarlanır (Payment.amount ile aynı kural). */
export function applyPercentDiscount(basePrice: number, discountPercent: number): number {
  const clamped = Math.min(100, Math.max(0, discountPercent));
  return Math.round(basePrice * (1 - clamped / 100));
}

/**
 * Bir öğrenci için, aktif bir "sibling" kampanyası ve ≥2 hane üyesi varsa
 * indirimli fiyatı döner; aksi halde `undefined` (kampanya uygulanamaz).
 */
export function previewSiblingDiscount(
  students: Student[],
  studentId: string,
  branchId: string | undefined,
  basePrice: number,
  campaigns: DiscountCampaign[],
  now: Date = new Date()
): { campaign: DiscountCampaign; discountedPrice: number } | undefined {
  const campaign = findApplicableSiblingCampaign(campaigns, branchId, now);
  if (!campaign) return undefined;
  const householdSize = countActiveHouseholdMembers(students, studentId);
  if (householdSize < 2) return undefined;
  return { campaign, discountedPrice: applyPercentDiscount(basePrice, campaign.discountPercent) };
}

export type DiscountCampaignInput = {
  name: string;
  kind: DiscountCampaign["kind"];
  discountPercent: number;
  validFrom?: string;
  validTo?: string;
  branchId?: string;
  createdBy: string;
};

export type DiscountCampaignMutationResult =
  | { ok: true; data: AppData; campaign: DiscountCampaign }
  | { ok: false; message: string };

/** Store-agnostic saf veri dönüşümü — aynı desen `packages.ts` createPackageData. */
export function createDiscountCampaignData(
  data: AppData,
  input: DiscountCampaignInput,
  now: Date = new Date()
): DiscountCampaignMutationResult {
  if (!input.name.trim()) return { ok: false, message: "Kampanya adı boş olamaz." };
  if (!Number.isInteger(input.discountPercent) || input.discountPercent < 1 || input.discountPercent > 100) {
    return { ok: false, message: "İndirim oranı 1-100 arası tam sayı olmalı." };
  }
  const nowIso = now.toISOString();
  const campaign: DiscountCampaign = {
    id: uid("campaign"),
    name: input.name.trim(),
    kind: input.kind,
    discountPercent: input.discountPercent,
    active: true,
    validFrom: input.validFrom,
    validTo: input.validTo,
    branchId: input.branchId as DiscountCampaign["branchId"],
    createdBy: input.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return {
    ok: true,
    data: { ...data, discountCampaigns: [...(data.discountCampaigns ?? []), campaign] },
    campaign,
  };
}

export type DiscountCampaignPatch = Partial<
  Pick<DiscountCampaign, "name" | "discountPercent" | "active" | "validFrom" | "validTo">
>;

export function updateDiscountCampaignData(
  data: AppData,
  campaignId: string,
  patch: DiscountCampaignPatch,
  now: Date = new Date()
): DiscountCampaignMutationResult {
  const existing = (data.discountCampaigns ?? []).find((c) => c.id === campaignId);
  if (!existing) return { ok: false, message: "Kampanya bulunamadı." };
  if (
    patch.discountPercent !== undefined &&
    (!Number.isInteger(patch.discountPercent) || patch.discountPercent < 1 || patch.discountPercent > 100)
  ) {
    return { ok: false, message: "İndirim oranı 1-100 arası tam sayı olmalı." };
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    return { ok: false, message: "Kampanya adı boş olamaz." };
  }
  const updated: DiscountCampaign = {
    ...existing,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    updatedAt: now.toISOString(),
  };
  const discountCampaigns = (data.discountCampaigns ?? []).map((c) => (c.id === campaignId ? updated : c));
  return { ok: true, data: { ...data, discountCampaigns }, campaign: updated };
}
