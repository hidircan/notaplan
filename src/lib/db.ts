import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

/**
 * Lazy Prisma client — sadece STORE_MODE=db iken çağrılır.
 * Import zamanında DATABASE_URL zorunlu olmasın (json/memory deploy için).
 */
export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.startsWith("file:")) {
    throw new Error(
      "STORE_MODE=db için geçerli bir MySQL/MariaDB DATABASE_URL gerekli (ör. mysql://user:pass@host:3306/db)."
    );
  }

  const client = new PrismaClient({
    adapter: new PrismaMariaDb(databaseUrl),
    log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["error", "warn"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  } else {
    globalForPrisma.prisma = client;
  }

  return client;
}

/** Geriye uyumluluk: store-db `prisma` import edebilir */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
