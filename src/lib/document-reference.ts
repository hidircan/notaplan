/**
 * PRODUCT_BACKLOG §6.3 — ortak belge referansı.
 * Makbuz `buildReceiptReference` ile aynı deterministik FNV tarzı yaklaşım;
 * entity+id için sabit referans (yeniden basımda korunur).
 * Yeni DocumentInstance her zaman yeni id → yeni referans.
 *
 * Format: `NP-{TÜR_KISALTMASI}-{YIL}-{8-HANE-HEX}`. Yıl, belgenin oluşturma
 * yılı — anlaşılır/aranabilir (MT gereksinimi: "tür ve yıl bilgisi içersin"),
 * ama HEX kısmı `kind:instanceId` üzerinden FNV-1a hash'i olduğu için
 * SIRALI/tahmin edilebilir DEĞİL (`instanceId` her zaman yeni bir rastgele
 * `uid()`). Benzersizlik ayrıca DB seviyesinde `@@unique([tenantId,
 * reference])` ile garanti edilir (bkz. prisma/schema.prisma
 * DocumentInstance) — bu fonksiyon yalnızca DETERMİNİSTİK biçimlendirmeden
 * sorumludur, çakışma/idempotency kontrolü çağıran tarafta (documents/
 * index.ts createDocumentInstance) yapılır.
 */

export function buildDocumentReference(kind: string, instanceId: string, year?: number): string {
  const input = `${kind}:${instanceId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const prefix = kind
    .split("_")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
  const y = year ?? new Date().getFullYear();
  return `NP-${prefix || "DOC"}-${y}-${hex}`;
}

/** Makbuz ile paylaşılan yardımcıyı yeniden dışa aktar (tek yerden referans ailesi). */
export { buildReceiptReference } from "./receipt";
