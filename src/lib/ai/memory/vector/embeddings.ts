/**
 * EmbeddingService abstraction — OpenAI / Gemini / Local / offline hash.
 */

import type { EmbeddingProviderName, EmbeddingService } from "./types";
import { normalizeVector } from "./math";

function getDims(): number {
  return Number(process.env.EMBEDDING_DIMS || 384);
}

/** Deterministic bag-of-hashes embedding for offline/dev (no API key). */
export function createHashEmbeddingService(dims = getDims()): EmbeddingService {
  return {
    name: "hash",
    model: "hash-v1",
    dimensions: dims,
    async embed(text: string) {
      const vec = new Array(dims).fill(0);
      const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      for (const t of tokens) {
        let h = 2166136261;
        for (let i = 0; i < t.length; i++) {
          h ^= t.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        const idx = Math.abs(h) % dims;
        vec[idx] += 1;
        vec[(idx + 1) % dims] += 0.5;
      }
      return normalizeVector(vec);
    },
  };
}

export function createOpenAiEmbeddingService(): EmbeddingService {
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const dims = Number(process.env.EMBEDDING_DIMS || 1536);
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const apiKey = process.env.OPENAI_API_KEY || "";
  return {
    name: "openai",
    model,
    dimensions: dims,
    async embed(text: string) {
      if (!apiKey) throw new Error("OPENAI_API_KEY required for OpenAI embeddings");
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input: text.slice(0, 8000) }),
      });
      const data = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
        error?: { message?: string };
      };
      if (!res.ok || !data.data?.[0]?.embedding) {
        throw new Error(data.error?.message || `OpenAI embeddings HTTP ${res.status}`);
      }
      return data.data[0].embedding;
    },
  };
}

export function createGeminiEmbeddingService(): EmbeddingService {
  const model = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const dims = Number(process.env.EMBEDDING_DIMS || 768);
  return {
    name: "gemini",
    model,
    dimensions: dims,
    async embed(text: string) {
      if (!apiKey) throw new Error("GEMINI_API_KEY required for Gemini embeddings");
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
        }),
      });
      const data = (await res.json()) as {
        embedding?: { values?: number[] };
        error?: { message?: string };
      };
      if (!res.ok || !data.embedding?.values) {
        throw new Error(data.error?.message || `Gemini embeddings HTTP ${res.status}`);
      }
      return data.embedding.values;
    },
  };
}

export function createLocalEmbeddingService(): EmbeddingService {
  const baseUrl = (process.env.LOCAL_EMBEDDING_URL || "").replace(/\/$/, "");
  const model = process.env.LOCAL_EMBEDDING_MODEL || "local-embed";
  const dims = Number(process.env.EMBEDDING_DIMS || 384);
  const apiKey = process.env.LOCAL_EMBEDDING_KEY || "local";
  return {
    name: "local",
    model,
    dimensions: dims,
    async embed(text: string) {
      if (!baseUrl) throw new Error("LOCAL_EMBEDDING_URL required");
      // OpenAI-compatible /embeddings
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input: text.slice(0, 8000) }),
      });
      const data = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
        error?: { message?: string };
      };
      if (!res.ok || !data.data?.[0]?.embedding) {
        throw new Error(data.error?.message || `Local embeddings HTTP ${res.status}`);
      }
      return data.data[0].embedding;
    },
  };
}

export function getEmbeddingService(): EmbeddingService {
  const name = (process.env.EMBEDDING_PROVIDER || "auto").toLowerCase() as
    | EmbeddingProviderName
    | "auto";

  try {
    if (name === "openai" || (name === "auto" && process.env.OPENAI_API_KEY)) {
      return createOpenAiEmbeddingService();
    }
    if (
      name === "gemini" ||
      (name === "auto" && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY))
    ) {
      return createGeminiEmbeddingService();
    }
    if (name === "local" || (name === "auto" && process.env.LOCAL_EMBEDDING_URL)) {
      return createLocalEmbeddingService();
    }
  } catch {
    // fall through to hash
  }
  return createHashEmbeddingService();
}
