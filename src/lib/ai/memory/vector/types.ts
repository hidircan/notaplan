import type { MemoryRecord, MemoryScope } from "../types";

/** Provider-agnostic vector store contract */
export interface VectorStore {
  name: string;
  upsertVector(args: {
    id: string;
    tenantId: string;
    embedding: number[];
    payload: Record<string, unknown>;
  }): Promise<void>;
  deleteVector(args: { tenantId: string; id: string }): Promise<void>;
  search(args: {
    tenantId: string;
    embedding: number[];
    topK: number;
    minScore: number;
    filter?: {
      scopes?: MemoryScope[];
      scopeKeys?: string[];
    };
  }): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>>;
}

export type EmbeddingProviderName = "openai" | "gemini" | "local" | "hash";

export interface EmbeddingService {
  name: EmbeddingProviderName;
  model: string;
  dimensions: number;
  embed(text: string): Promise<number[]>;
}

export type VectorHit = {
  record: MemoryRecord;
  score: number;
};
