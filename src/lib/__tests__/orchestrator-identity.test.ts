import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runChatTurn } from "../ai/orchestrator";
import type { ServiceContext } from "../services/context";

const ENV_KEYS = [
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "XAI_API_KEY",
  "GROK_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "LOCAL_LLM_URL",
  "GROQ_API_KEY",
  "CEREBRAS_API_KEY",
  "NVIDIA_NIM_API_KEY",
] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

const ctx: ServiceContext = { role: "SCHOOL_ADMIN", userId: "user_orch_test", tenantId: "tenant_orch_identity" };

describe("runChatTurn — 'hangi modelsin' sorusu (uçtan uca, gerçek plan/tool/narrate çağrısı yapmadan)", () => {
  it("API anahtarı yokken heuristic olduğunu VE nedenini açıklar", async () => {
    const result = await runChatTurn({ ctx, message: "merhaba sen hangi modelsin" });
    expect(result.assistantMessage.content).toMatch(/heuristic/i);
    expect(result.assistantMessage.content).toMatch(/API anahtarı/i);
    expect(result.toolMessages).toEqual([]);
  });

  it("GEMINI_API_KEY yapılandırılmışsa gerçek provider adını döner", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const result = await runChatTurn({ ctx, message: "hangi modelsin?" });
    expect(result.assistantMessage.content).toMatch(/Gemini/i);
    expect(result.assistantMessage.content).not.toMatch(/heuristic/i);
  });

  it("kimlik sorusu olmayan bir istek normal plan/tool akışına girer (kısayola takılmaz)", async () => {
    const result = await runChatTurn({ ctx, message: "s1 bakiyesi" });
    expect(result.assistantMessage.content).not.toMatch(/API anahtarı yapılandırılmamış/i);
  });
});
