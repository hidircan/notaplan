/**
 * Cloudflare Workers AI — `POST /client/v4/accounts/:account_id/ai/run/:model`.
 * NOT OpenAI-compatible (different host, path, and response envelope), so it
 * cannot reuse `openai-compatible.ts`. Text-only: Workers AI's tool/function
 * calling contract is model-specific and not uniformly documented enough to
 * implement safely here, so `plan()` never returns `toolCalls` — this
 * provider only narrates. If that changes, it's a separate, verified change.
 */
import type { LlmProvider } from "../types";
import { LlmProviderError, isAuthConfigError } from "../config";
import { withRetry } from "../retry";

export type CloudflareWorkersAiConfig = {
  accountId: string;
  apiToken: string;
  model: string;
  timeoutMs?: number;
};

type WorkersAiResponse = {
  result?: { response?: string };
  success?: boolean;
  errors?: Array<{ message?: string }>;
};

async function runOnce(
  cfg: CloudflareWorkersAiConfig,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    cfg.accountId
  )}/ai/run/${cfg.model}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 60_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiToken}`,
      },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    const data = (await res.json()) as WorkersAiResponse;
    if (!res.ok || data.success === false) {
      throw new LlmProviderError(
        data.errors?.[0]?.message || `Cloudflare Workers AI HTTP ${res.status}`,
        "cloudflareAi",
        res.status
      );
    }
    return data.result?.response || "";
  } catch (e) {
    if (e instanceof LlmProviderError) throw e;
    throw new LlmProviderError(
      e instanceof Error ? e.message : "Cloudflare Workers AI request failed",
      "cloudflareAi"
    );
  } finally {
    clearTimeout(timer);
  }
}

function complete(
  cfg: CloudflareWorkersAiConfig,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  return withRetry(() => runOnce(cfg, messages), {
    retries: Number(process.env.AI_RETRY_COUNT || 2),
    timeoutMs: (cfg.timeoutMs ?? 60_000) + 5_000,
    label: "cloudflareAi.complete",
    shouldRetry: (e) => !isAuthConfigError(e),
  });
}

export function createCloudflareWorkersAiProvider(cfg: CloudflareWorkersAiConfig): LlmProvider {
  return {
    name: "cloudflareAi",

    async plan({ messages }) {
      const text = await complete(
        cfg,
        messages.map((m) => ({ role: m.role === "tool" ? "user" : m.role, content: m.content }))
      );
      return { assistantText: text || undefined };
    },

    async narrate({ userMessage, toolResults }) {
      const text = await complete(cfg, [
        {
          role: "system",
          content:
            "Summarize tool results for a school admin in clear natural language (Turkish if user wrote Turkish). Be concise.",
        },
        { role: "user", content: `User: ${userMessage}\nResults: ${JSON.stringify(toolResults)}` },
      ]);
      return text || "İşlem tamamlandı.";
    },
  };
}
