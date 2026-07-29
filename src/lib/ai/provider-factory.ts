import type { LlmProvider } from "./types";
import { getProviderConfig } from "./config";
import { heuristicProvider } from "./providers/heuristic";
import { createOpenAiCompatibleProvider } from "./providers/openai-compatible";
import { createGeminiProvider } from "./providers/gemini";

/**
 * Resolve production LLM provider from environment.
 * Falls back to heuristic when no API key is configured.
 */
export function getLlmProvider(): LlmProvider {
  const cfg = getProviderConfig();

  try {
    if (cfg.name === "openai" || cfg.name === "grok" || cfg.name === "local") {
      if (!cfg.apiKey || !cfg.baseUrl) return heuristicProvider;
      return createOpenAiCompatibleProvider({
        name: cfg.name,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        timeoutMs: cfg.timeoutMs,
      });
    }

    if (cfg.name === "gemini") {
      if (!cfg.apiKey) return heuristicProvider;
      return createGeminiProvider({
        apiKey: cfg.apiKey,
        model: cfg.model,
        timeoutMs: cfg.timeoutMs,
      });
    }
  } catch {
    return heuristicProvider;
  }

  return heuristicProvider;
}

export function describeActiveProvider(): { name: string; model: string } {
  const cfg = getProviderConfig();
  return { name: cfg.name, model: cfg.model };
}
