/**
 * PRODUCT_BACKLOG §6.3 — ortak belge referansı.
 * Makbuz `buildReceiptReference` ile aynı deterministik FNV tarzı yaklaşım;
 * entity+id için sabit referans (yeniden basımda korunur).
 * Yeni DocumentInstance her zaman yeni id → yeni referans.
 */

export function buildDocumentReference(kind: string, instanceId: string): string {
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
  return `NP-${prefix || "DOC"}-${hex}`;
}

/** Makbuz ile paylaşılan yardımcıyı yeniden dışa aktar (tek yerden referans ailesi). */
export { buildReceiptReference } from "./receipt";
