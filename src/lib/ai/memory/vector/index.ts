import type { VectorStore } from "./types";
import { FileVectorStore } from "./file-vector-store";
import { PgVectorStore } from "./pgvector-store";
import { QdrantStore } from "./qdrant-store";
import { getEmbeddingService } from "./embeddings";

export type { VectorStore, EmbeddingService, EmbeddingProviderName } from "./types";
export { getEmbeddingService } from "./embeddings";
export { cosineSimilarity } from "./math";
export { FileVectorStore } from "./file-vector-store";
export { PgVectorStore } from "./pgvector-store";
export { QdrantStore } from "./qdrant-store";

/**
 * VECTOR_BACKEND=file|pgvector|qdrant (default: file)
 */
export function getVectorStore(): VectorStore {
  const backend = (process.env.VECTOR_BACKEND || "file").toLowerCase();
  if (backend === "pgvector" || backend === "postgres") {
    return new PgVectorStore();
  }
  if (backend === "qdrant") {
    return new QdrantStore();
  }
  return new FileVectorStore();
}

export function getVectorConfig() {
  return {
    backend: process.env.VECTOR_BACKEND || "file",
    topK: Number(process.env.MEMORY_TOP_K || 10),
    minScore: Number(process.env.MEMORY_MIN_SCORE || 0.25),
    embedding: (() => {
      try {
        const e = getEmbeddingService();
        return { provider: e.name, model: e.model, dimensions: e.dimensions };
      } catch {
        return { provider: "hash", model: "hash-v1", dimensions: 384 };
      }
    })(),
  };
}
