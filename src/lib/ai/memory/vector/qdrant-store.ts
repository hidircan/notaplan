/**
 * QdrantStore — optional HTTP adapter (Qdrant REST API).
 * Env: QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION (default notaplan_memory)
 */

import type { MemoryScope } from "../types";
import type { VectorStore } from "./types";

function base() {
  return (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/$/, "");
}

function collection() {
  return process.env.QDRANT_COLLECTION || "notaplan_memory";
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.QDRANT_API_KEY) {
    h["api-key"] = process.env.QDRANT_API_KEY;
  }
  return h;
}

export class QdrantStore implements VectorStore {
  name = "qdrant";

  private async ensureCollection(dims: number): Promise<void> {
    const res = await fetch(`${base()}/collections/${collection()}`, {
      headers: headers(),
    });
    if (res.ok) return;
    await fetch(`${base()}/collections/${collection()}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        vectors: { size: dims, distance: "Cosine" },
      }),
    });
  }

  async upsertVector(args: {
    id: string;
    tenantId: string;
    embedding: number[];
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.ensureCollection(args.embedding.length);
    const pointId = `${args.tenantId}:${args.id}`;
    const res = await fetch(`${base()}/collections/${collection()}/points?wait=true`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        points: [
          {
            id: hashId(pointId),
            vector: args.embedding,
            payload: { ...args.payload, tenantId: args.tenantId, memoryId: args.id },
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Qdrant upsert failed: ${t.slice(0, 200)}`);
    }
  }

  async deleteVector(args: { tenantId: string; id: string }): Promise<void> {
    const pointId = hashId(`${args.tenantId}:${args.id}`);
    await fetch(`${base()}/collections/${collection()}/points/delete?wait=true`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ points: [pointId] }),
    });
  }

  async search(args: {
    tenantId: string;
    embedding: number[];
    topK: number;
    minScore: number;
    filter?: { scopes?: MemoryScope[]; scopeKeys?: string[] };
  }) {
    const must: unknown[] = [
      { key: "tenantId", match: { value: args.tenantId } },
    ];
    if (args.filter?.scopes?.length === 1) {
      must.push({ key: "scope", match: { value: args.filter.scopes[0] } });
    }

    const res = await fetch(`${base()}/collections/${collection()}/points/search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        vector: args.embedding,
        limit: args.topK,
        score_threshold: args.minScore,
        with_payload: true,
        filter: { must },
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      result?: Array<{ score?: number; payload?: Record<string, unknown> }>;
    };
    return (data.result || [])
      .map((r) => ({
        id: String(r.payload?.memoryId || ""),
        score: Number(r.score || 0),
        payload: r.payload || {},
      }))
      .filter((h) => h.id)
      .filter((h) => {
        if (!args.filter?.scopeKeys?.length) return true;
        return args.filter.scopeKeys.includes(String(h.payload.scopeKey || ""));
      });
  }
}

/** Qdrant prefers unsigned int or UUID — hash string to stable uint */
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
