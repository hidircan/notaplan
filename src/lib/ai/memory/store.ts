/**
 * File/memory backend for AI memories.
 * Designed so a VectorMemoryStore (pgvector/Qdrant/Pinecone) can replace this later.
 */

import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../../config";
import type { MemoryBackend, MemoryQuery, MemoryRecord } from "./types";

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

/** Naive lexical score — replaced by cosine(embedding) with vector DB later */
function scoreText(content: string, query?: string): number {
  if (!query) return 0.5;
  const q = new Set(tokenize(query));
  if (!q.size) return 0.5;
  const tokens = tokenize(content);
  let hit = 0;
  for (const t of tokens) if (q.has(t)) hit += 1;
  return hit / q.size;
}

export class FileMemoryStore implements MemoryBackend {
  async upsert(
    record: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<MemoryRecord> {
    const data = await load();
    const now = new Date().toISOString();
    if (record.id) {
      const idx = data.records.findIndex(
        (r) => r.id === record.id && r.tenantId === record.tenantId
      );
      if (idx >= 0) {
        const next: MemoryRecord = {
          ...data.records[idx],
          ...record,
          id: record.id,
          updatedAt: now,
          embedding: record.embedding ?? data.records[idx].embedding ?? null,
        };
        data.records[idx] = next;
        await save(data);
        return next;
      }
    }
    const created: MemoryRecord = {
      id: record.id || `mem_${crypto.randomUUID().slice(0, 12)}`,
      createdAt: now,
      updatedAt: now,
      embedding: record.embedding ?? null,
      embeddingModel: record.embeddingModel ?? null,
      tenantId: record.tenantId,
      scope: record.scope,
      kind: record.kind,
      scopeKey: record.scopeKey,
      content: record.content,
      metadata: record.metadata,
    };
    data.records.unshift(created);
    await save(data);
    return created;
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
    const scopes = query.scopes || ["conversation", "user", "tenant", "workflow"];
    const candidates = data.records.filter((r) => {
      if (r.tenantId !== query.tenantId) return false;
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
    });

    // TODO(vector): if embedding present, rank by cosine similarity via pgvector/Qdrant/Pinecone
    const scored = candidates.map((r) => ({
      ...r,
      score: scoreText(r.content, query.queryText),
    }));
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));
    return scored.slice(0, query.limit ?? 12);
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const data = await load();
    const before = data.records.length;
    data.records = data.records.filter((r) => !(r.tenantId === tenantId && r.id === id));
    await save(data);
    return data.records.length < before;
  }
}

/** Singleton — swap for VectorMemoryStore when VECTOR_BACKEND is set */
export const memoryStore: MemoryBackend = new FileMemoryStore();
