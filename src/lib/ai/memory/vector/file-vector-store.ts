/**
 * FileVectorStore — development semantic store backed by JSON + cosine.
 * Vectors live on MemoryRecord.embedding; this indexes them for search.
 */

import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../../../config";
import type { MemoryScope } from "../types";
import type { VectorStore } from "./types";
import { cosineSimilarity } from "./math";

type VecRow = {
  id: string;
  tenantId: string;
  embedding: number[];
  payload: Record<string, unknown>;
};

type Shape = { vectors: VecRow[] };

const g = globalThis as unknown as { __notaplanVectors?: Shape };

function mem(): Shape {
  if (!g.__notaplanVectors) g.__notaplanVectors = { vectors: [] };
  return g.__notaplanVectors;
}

function filePath() {
  return path.join(resolveDataDir(path.join(process.cwd(), "data")), "ai-vectors.json");
}

async function load(): Promise<Shape> {
  const m = mem();
  if (m.vectors.length) return m;
  try {
    const raw = await fs.readFile(filePath(), "utf-8");
    const data = JSON.parse(raw) as Shape;
    g.__notaplanVectors = data;
    return data;
  } catch {
    return m;
  }
}

async function save(data: Shape): Promise<void> {
  g.__notaplanVectors = data;
  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(data), "utf-8");
  } catch {
    /* ok */
  }
}

export class FileVectorStore implements VectorStore {
  name = "file";

  async upsertVector(args: {
    id: string;
    tenantId: string;
    embedding: number[];
    payload: Record<string, unknown>;
  }): Promise<void> {
    const data = await load();
    const idx = data.vectors.findIndex(
      (v) => v.id === args.id && v.tenantId === args.tenantId
    );
    const row: VecRow = {
      id: args.id,
      tenantId: args.tenantId,
      embedding: args.embedding,
      payload: args.payload,
    };
    if (idx >= 0) data.vectors[idx] = row;
    else data.vectors.push(row);
    await save(data);
  }

  async deleteVector(args: { tenantId: string; id: string }): Promise<void> {
    const data = await load();
    data.vectors = data.vectors.filter(
      (v) => !(v.tenantId === args.tenantId && v.id === args.id)
    );
    await save(data);
  }

  async search(args: {
    tenantId: string;
    embedding: number[];
    topK: number;
    minScore: number;
    filter?: { scopes?: MemoryScope[]; scopeKeys?: string[] };
  }) {
    const data = await load();
    const hits: Array<{ id: string; score: number; payload: Record<string, unknown> }> =
      [];

    for (const v of data.vectors) {
      if (v.tenantId !== args.tenantId) continue;
      const scope = v.payload.scope as MemoryScope | undefined;
      const scopeKey = String(v.payload.scopeKey || "");
      if (args.filter?.scopes?.length && scope && !args.filter.scopes.includes(scope)) {
        continue;
      }
      if (args.filter?.scopeKeys?.length && !args.filter.scopeKeys.includes(scopeKey)) {
        continue;
      }
      const score = cosineSimilarity(args.embedding, v.embedding);
      if (score < args.minScore) continue;
      hits.push({ id: v.id, score, payload: v.payload });
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, args.topK);
  }
}
