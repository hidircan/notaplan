/**
 * PRODUCT_BACKLOG §1.3 / §3.1 — T.C. kimlik hassas veri.
 * At-rest şifreleme (AES-256-GCM), listede yok, detayda maskeli,
 * tam çözümleme yalnız yetkili + audit çağıranın sorumluluğunda.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(): Buffer {
  const raw =
    process.env.PII_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "notaplan-dev-only-pii-key-change-me";
  // 32-byte key from scrypt (stable for same secret)
  return scryptSync(raw, "notaplan-pii-v1", 32);
}

/** 11 haneli T.C. algoritmik doğrulama (checksum). */
export function isValidTurkishNationalId(input: string): boolean {
  const id = input.replace(/\D/g, "");
  if (!/^[1-9]\d{10}$/.test(id)) return false;
  const d = id.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const check10 = (((odd * 7 - even) % 10) + 10) % 10;
  if (check10 !== d[9]) return false;
  const sum10 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return sum10 === d[10];
}

export function normalizeNationalId(input: string): string {
  return input.replace(/\D/g, "");
}

/** Mask: *********34 — son 2 hane (liste asla göstermez; detay varsayılanı). */
export function maskNationalId(last2: string | undefined | null): string {
  if (!last2 || last2.length < 1) return "***********";
  const tail = last2.slice(-2).padStart(2, "*");
  return `${"*".repeat(9)}${tail}`;
}

export type EncryptedNationalId = {
  /** base64: iv + tag + ciphertext */
  cipher: string;
  last2: string;
};

export function encryptNationalId(plain: string): EncryptedNationalId {
  const id = normalizeNationalId(plain);
  if (!isValidTurkishNationalId(id)) {
    throw new Error("Geçersiz T.C. kimlik numarası");
  }
  const key = resolveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(id, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, enc]);
  return { cipher: packed.toString("base64"), last2: id.slice(-2) };
}

export function decryptNationalId(cipherB64: string): string {
  const key = resolveKey();
  const packed = Buffer.from(cipherB64, "base64");
  if (packed.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Bozuk şifreli kimlik verisi");
  }
  const iv = packed.subarray(0, IV_LEN);
  const tag = packed.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = packed.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return plain;
}

/** Doğum tarihinden yaş (tam yıl). */
export function ageFromBirthDate(isoDate: string, now: Date = new Date()): number {
  const b = new Date(isoDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

/** Deterministik fingerprint for dedupe without storing plain id (optional). */
export function nationalIdFingerprint(plain: string): string {
  return createHash("sha256").update(normalizeNationalId(plain) + "|notaplan").digest("hex").slice(0, 32);
}
