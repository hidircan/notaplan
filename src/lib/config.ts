/**
 * STORE_MODE:
 * - json  → local file (./data) veya Vercel'de /tmp (demo)
 * - db    → Prisma MySQL/MariaDB (production kalıcı)
 * - memory → process memory (serverless demo, cold start'ta seed)
 */
const mode = (process.env.STORE_MODE ?? "json").toLowerCase();

export const STORE_MODE: "json" | "db" | "memory" =
  mode === "db" ? "db" : mode === "memory" ? "memory" : "json";

export const DATABASE_PROVIDER = process.env.DATABASE_PROVIDER ?? "mysql";
export const DATABASE_URL = process.env.DATABASE_URL ?? "";
export const isDbMode = STORE_MODE === "db";
export const isMemoryMode = STORE_MODE === "memory";

/** Vercel serverless'da kalıcı disk yok → /tmp veya memory kullan */
export function resolveDataDir(defaultDir: string) {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp/notaplan-data";
  }
  return defaultDir;
}
