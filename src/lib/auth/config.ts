/**
 * Auth config from env.
 * JWT_SECRET must be set in production; build/dev has a non-production fallback.
 */
export function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "notaplan-dev-secret-change-me-in-production-32b");

  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short (min 16 chars). Set it in environment variables."
    );
  }
  return new TextEncoder().encode(secret);
}

export const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || "15m";
export const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || "7d";

export const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || "tenant_nilufer_acar";
