export const STORE_MODE = process.env.STORE_MODE?.toLowerCase() === "db" ? "db" : "json";
export const DATABASE_PROVIDER = process.env.DATABASE_PROVIDER ?? "sqlite";
export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./dev.db";
export const isDbMode = STORE_MODE === "db";
