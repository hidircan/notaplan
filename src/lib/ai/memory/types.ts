/**
 * AI Memory Layer types.
 * Future vector backends: pgvector | Qdrant | Pinecone (see embedding field).
 */

export type MemoryScope =
  | "conversation" // short-term, tied to conversationId
  | "user" // long-term per user
  | "tenant" // school-wide
  | "workflow"; // workflow outcomes / preferences

export type MemoryKind =
  | "preference"
  | "recurring_request"
  | "teacher_preference"
  | "parent_preference"
  | "workflow_outcome"
  | "fact"
  | "summary";

export type MemoryRecord = {
  id: string;
  tenantId: string;
  scope: MemoryScope;
  kind: MemoryKind;
  /** Scope key: conversationId | userId | tenantId | workflowId */
  scopeKey: string;
  content: string;
  /** Optional structured payload */
  metadata?: Record<string, unknown>;
  /** Placeholder for future vector search */
  embedding?: number[] | null;
  embeddingModel?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Soft relevance score when retrieved */
  score?: number;
};

export type MemoryQuery = {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  workflowId?: string;
  queryText?: string;
  scopes?: MemoryScope[];
  /** topK for semantic search (alias of limit) */
  topK?: number;
  limit?: number;
  /** Minimum cosine similarity (default from MEMORY_MIN_SCORE) */
  minScore?: number;
  /** Optional precomputed query embedding */
  queryEmbedding?: number[];
};

/** Record store — vectors may be dual-written to VectorStore */
export interface MemoryBackend {
  upsert(record: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<MemoryRecord>;
  list(tenantId: string, filter?: Partial<Pick<MemoryRecord, "scope" | "scopeKey" | "kind">>): Promise<MemoryRecord[]>;
  search(query: MemoryQuery): Promise<MemoryRecord[]>;
  delete(tenantId: string, id: string): Promise<boolean>;
}
