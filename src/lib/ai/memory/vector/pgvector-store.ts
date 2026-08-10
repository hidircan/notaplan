/**
 * PgVectorStore — preferred production backend (PostgreSQL + pgvector).
 * Requires DATABASE_URL (postgres) and extension vector.
 * Falls back gracefully if pg is unavailable or connection fails.
 */

import type { MemoryScope } from "../types";
import type { VectorStore } from "./types";

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

async function getClient(): Promise<PgClient | null> {
  const url = process.env.DATABASE_URL || process.env.PGVECTOR_URL || "";
  if (!url.startsWith("postgres")) return null;
  try {
    // Dynamic load so Next/Turbopack does not bundle optional `pg`
    const dynamicRequire = new Function(
      "name",
      "return require(name)"
    ) as (name: string) => {
      Client: new (c: { connectionString: string }) => PgClient & {
        connect: () => Promise<void>;
      };
    };
    const mod = dynamicRequire("pg");
    const client = new mod.Client({ connectionString: url });
    await client.connect();
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_memory_vectors (
        id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        embedding vector,
        payload JSONB NOT NULL DEFAULT '{}',
        PRIMARY KEY (tenant_id, id)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS ai_memory_vectors_tenant_idx ON ai_memory_vectors (tenant_id)"
    );
    return client;
  } catch {
    return null;
  }
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export class PgVectorStore implements VectorStore {
  name = "pgvector";

  async upsertVector(args: {
    id: string;
    tenantId: string;
    embedding: number[];
    payload: Record<string, unknown>;
  }): Promise<void> {
    const client = await getClient();
    if (!client) throw new Error("PgVectorStore: no postgres connection");
    try {
      await client.query(
        `INSERT INTO ai_memory_vectors (id, tenant_id, embedding, payload)
         VALUES ($1, $2, $3::vector, $4::jsonb)
         ON CONFLICT (tenant_id, id)
         DO UPDATE SET embedding = EXCLUDED.embedding, payload = EXCLUDED.payload`,
        [args.id, args.tenantId, toVectorLiteral(args.embedding), JSON.stringify(args.payload)]
      );
    } finally {
      await client.end();
    }
  }

  async deleteVector(args: { tenantId: string; id: string }): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
      await client.query(
        "DELETE FROM ai_memory_vectors WHERE tenant_id = $1 AND id = $2",
        [args.tenantId, args.id]
      );
    } finally {
      await client.end();
    }
  }

  async search(args: {
    tenantId: string;
    embedding: number[];
    topK: number;
    minScore: number;
    filter?: { scopes?: MemoryScope[]; scopeKeys?: string[] };
  }) {
    const client = await getClient();
    if (!client) return [];
    try {
      // cosine distance <=> ; similarity = 1 - distance
      const { rows } = await client.query(
        `SELECT id, payload, 1 - (embedding <=> $2::vector) AS score
         FROM ai_memory_vectors
         WHERE tenant_id = $1
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        [args.tenantId, toVectorLiteral(args.embedding), args.topK * 3]
      );

      return rows
        .map((r) => {
          const payload = (typeof r.payload === "string"
            ? JSON.parse(r.payload as string)
            : r.payload) as Record<string, unknown>;
          const score = Number(r.score);
          return { id: String(r.id), score, payload };
        })
        .filter((h) => {
          if (h.score < args.minScore) return false;
          const scope = h.payload.scope as MemoryScope | undefined;
          const scopeKey = String(h.payload.scopeKey || "");
          if (args.filter?.scopes?.length && scope && !args.filter.scopes.includes(scope)) {
            return false;
          }
          if (args.filter?.scopeKeys?.length && !args.filter.scopeKeys.includes(scopeKey)) {
            return false;
          }
          return true;
        })
        .slice(0, args.topK);
    } finally {
      await client.end();
    }
  }
}
