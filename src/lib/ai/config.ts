/**
 * Centralized LLM provider configuration & errors.
 */

export type ResolvedProviderConfig = {
  name: "openai" | "grok" | "gemini" | "local" | "heuristic";
  model: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs: number;
};

export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly status?: number,
    public readonly causeDetail?: string
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}

export function getProviderConfig(): ResolvedProviderConfig {
  const requested = (process.env.AI_PROVIDER || "auto").toLowerCase();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 60_000);

  const openaiKey = process.env.OPENAI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const localUrl = process.env.LOCAL_LLM_URL;

  const pick = (name: ResolvedProviderConfig["name"]): ResolvedProviderConfig | null => {
    if (name === "openai" && openaiKey) {
      return {
        name: "openai",
        model: process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: openaiKey,
        timeoutMs,
      };
    }
    if (name === "grok" && xaiKey) {
      return {
        name: "grok",
        model: process.env.AI_MODEL || process.env.GROK_MODEL || "grok-2-latest",
        baseUrl: process.env.XAI_BASE_URL || "https://api.x.ai/v1",
        apiKey: xaiKey,
        timeoutMs,
      };
    }
    if (name === "gemini" && geminiKey) {
      return {
        name: "gemini",
        model: process.env.AI_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash",
        apiKey: geminiKey,
        timeoutMs,
      };
    }
    if (name === "local" && localUrl) {
      return {
        name: "local",
        model: process.env.AI_MODEL || process.env.LOCAL_LLM_MODEL || "local-model",
        baseUrl: localUrl,
        apiKey: process.env.LOCAL_LLM_KEY || "local",
        timeoutMs,
      };
    }
    if (name === "heuristic") {
      return { name: "heuristic", model: "heuristic", timeoutMs };
    }
    return null;
  };

  if (requested !== "auto") {
    return pick(requested as ResolvedProviderConfig["name"]) || {
      name: "heuristic",
      model: "heuristic",
      timeoutMs,
    };
  }

  // auto: first available real provider, else heuristic
  return (
    pick("openai") ||
    pick("grok") ||
    pick("gemini") ||
    pick("local") || { name: "heuristic", model: "heuristic", timeoutMs }
  );
}
