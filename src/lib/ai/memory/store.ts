/**
 * File memory record store + semantic search via VectorStore/EmbeddingService.
 * Memory Layer stays independent of embedding/vector provider implementations.
 */

import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../../config";
import type { MemoryBackend, MemoryQuery, MemoryRecord } from "./types";
import { getEmbeddingService, getVectorStore } from "./vector";
import { cosineSimilarity } from "./vector/math";

type StoreShape = { records: MemoryRecord[] };

const g = globalThis as unknown as { __notaplanMemory?: StoreShape };

function mem(): StoreShape {
  if (!g.__notaplanMemory) g.__notaplanMemory = { records: [] };
  return g.__notaplanMemory;
}

function filePath() {
  return path.join(resolveDataDir(path.join(process.cwd(), "data")), "ai-memory.json");
}

async function load(): Promise<StoreShape> {
  const m = mem();
  if (m.records.length) return m;
  try {
    const raw = await fs.readFile(filePath(), "utf-8");
    const data = JSON.parse(raw) as StoreShape;
    g.__notaplanMemory = data;
    return data;
  } catch {
    return m;
  }
}

async function save(data: StoreShape): Promise<void> {
  g.__notaplanMemory = data;
  if (data.records.length > 8000) data.records = data.records.slice(0, 8000);
  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(data, null, 2), "utf-8");
  } catch {
    /* memory still works */
  }
}

function defaultTopK(q: MemoryQuery) {
  return q.topK ?? q.limit ?? Number(process.env.MEMORY_TOP_K || 10);
}

function defaultMinScore(q: MemoryQuery) {
  return q.minScore ?? Number(process.env.MEMORY_MIN_SCORE || 0.25);
}

function scopeFilter(query: MemoryQuery, r: MemoryRecord): boolean {
  const scopes = query.scopes || ["conversation", "user", "tenant", "workflow"];
  if (!scopes.includes(r.scope)) return false;
  if (r.scope === "conversation" && query.conversationId) {
    return r.scopeKey === query.conversationId;
  }
  if (r.scope === "user" && query.userId) {
    return r.scopeKey === query.userId;
  }
  if (r.scope === "tenant") {
    return r.scopeKey === query.tenantId;
  }
  if (r.scope === "workflow" && query.workflowId) {
    return r.scopeKey === query.workflowId;
  }
  if (r.scope === "workflow" && !query.workflowId) return true;
  if (r.scope === "conversation" && !query.conversationId) return false;
  if (r.scope === "user" && !query.userId) return false;
  return true;
}

export class FileMemoryStore implements MemoryBackend {
  async upsert(
    record: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<MemoryRecord> {
    const data = await load();
    const now = new Date().toISOString();

    // Generate embedding on write when missing
    let embedding = record.embedding ?? null;
    let embeddingModel = record.embeddingModel ?? null;
    if (!embedding && record.content) {
      try {
        const emb = getEmbeddingService();
        embedding = await emb.embed(record.content);
        embeddingModel = emb.model;
      } catch {
        embedding = null;
      }
    }

    let saved: MemoryRecord;
    if (record.id) {
      const idx = data.records.findIndex(
        (r) => r.id === record.id && r.tenantId === record.tenantId
      );
      if (idx >= 0) {
        saved = {
          ...data.records[idx],
          ...record,
          id: record.id,
          updatedAt: now,
          embedding: embedding ?? data.records[idx].embedding ?? null,
          embeddingModel: embeddingModel ?? data.records[idx].embeddingModel ?? null,
        };
        data.records[idx] = saved;
        await save(data);
      } else {
        saved = {
          id: record.id,
          createdAt: now,
          updatedAt: now,
          embedding,
          embeddingModel,
          tenantId: record.tenantId,
          scope: record.scope,
          kind: record.kind,
          scopeKey: record.scopeKey,
          content: record.content,
          metadata: record.metadata,
        };
        data.records.unshift(saved);
        await save(data);
      }
    } else {
      saved = {
        id: `mem_${crypto.randomUUID().slice(0, 12)}`,
        createdAt: now,
        updatedAt: now,
        embedding,
        embeddingModel,
        tenantId: record.tenantId,
        scope: record.scope,
        kind: record.kind,
        scopeKey: record.scopeKey,
        content: record.content,
        metadata: record.metadata,
      };
      data.records.unshift(saved);
      await save(data);
    }

    // Dual-write vector index
    if (saved.embedding?.length) {
      try {
        const vs = getVectorStore();
        await vs.upsertVector({
          id: saved.id,
          tenantId: saved.tenantId,
          embedding: saved.embedding,
          payload: {
            scope: saved.scope,
            scopeKey: saved.scopeKey,
            kind: saved.kind,
            content: saved.content,
            metadata: saved.metadata || {},
          },
        });
      } catch {
        /* vector backend optional */
      }
    }

    return saved;
  }

  async list(
    tenantId: string,
    filter?: Partial<Pick<MemoryRecord, "scope" | "scopeKey" | "kind">>
  ): Promise<MemoryRecord[]> {
    const data = await load();
    return data.records.filter((r) => {
      if (r.tenantId !== tenantId) return false;
      if (filter?.scope && r.scope !== filter.scope) return false;
      if (filter?.scopeKey && r.scopeKey !== filter.scopeKey) return false;
      if (filter?.kind && r.kind !== filter.kind) return false;
      return true;
    });
  }

  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    const data = await load();
    const topK = defaultTopK(query);
    const minScore = defaultMinScore(query);
    const tenantRecords = data.records.filter(
      (r) => r.tenantId === query.tenantId && scopeFilter(query, r)
    );

    // Semantic path
    let queryEmbedding = query.queryEmbedding;
    if (!queryEmbedding && query.queryText) {
      try {
        queryEmbedding = await getEmbeddingService().embed(query.queryText);
      } catch {
        queryEmbedding = undefined;
      }
    }

    if (queryEmbedding?.length) {
      // Prefer dedicated vector store
      try {
        const vs = getVectorStore();
        const scopeKeys: string[] = [];
        if (query.conversationId) scopeKeys.push(query.conversationId);
        if (query.userId) scopeKeys.push(query.userId);
        scopeKeys.push(query.tenantId);
        if (query.workflowId) scopeKeys.push(query.workflowId);

        const hits = await vs.search({
          tenantId: query.tenantId,
          embedding: queryEmbedding,
          topK,
          minScore,
          filter: {
            scopes: query.scopes,
            // don't over-filter scopeKeys when multiple scopes mixed
          },
        });

        const byId = new Map(tenantRecords.map((r) => [r.id, r]));
        const fromVector: MemoryRecord[] = [];
        for (const h of hits) {
          const rec = byId.get(h.id);
          if (rec && scopeFilter(query, rec)) {
            fromVector.push({ ...rec, score: h.score });
          }
        }
        if (fromVector.length) return fromVector.slice(0, topK);
      } catch {
        /* fall through to in-record cosine */
      }

      const scored = tenantRecords
        .map((r) => ({
          ...r,
          score: r.embedding?.length
            ? cosineSimilarity(queryEmbedding!, r.embedding)
            : -1,
        }))
        .filter((r) => (r.score ?? -1) >= minScore)
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      if (scored.length) return scored.slice(0, topK);
    }

    // Lexical fallback
    const q = (query.queryText || "").toLowerCase();
    const scored = tenantRecords.map((r) => {
      const c = r.content.toLowerCase();
      let score = 0.1;
      if (q && c.includes(q)) score = 0.9;
      else if (q) {
        const parts = q.split(/\s+/).filter(Boolean);
        const hits = parts.filter((p) => c.includes(p)).length;
        score = parts.length ? hits / parts.length : 0.1;
      }
      return { ...r, score };
    });
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));
    return scored.filter((r) => (r.score || 0) >= Math.min(minScore, 0.1)).slice(0, topK);
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const data = await load();
    const before = data.records.length;
    data.records = data.records.filter((r) => !(r.tenantId === tenantId && r.id === id));
    await save(data);
    try {
      await getVectorStore().deleteVector({ tenantId, id });
    } catch {
      /* ok */
    }
    return data.records.length < before;
  }
}

export const memoryStore: MemoryBackend = new FileMemoryStore();
