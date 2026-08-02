import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * getProviderConfig()'s "auto" resolution — the single global provider used
 * by the chat orchestrator (`orchestrator.ts`) and "Hangi modelsin?"
 * (`response-shaping.ts`'s `describeIdentity()`). Must follow the same
 * Gemini → Groq → NVIDIA NIM → Cerebras → heuristic priority as
 * `PROVIDER_CHAIN` in `provider-chain.ts`.
 */

const ENV_KEYS = [
  "AI_PROVIDER",
  "AI_MODEL",
  "OPENAI_API_KEY",
  "XAI_API_KEY",
  "GROK_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_MODEL",
  "LOCAL_LLM_URL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "CEREBRAS_API_KEY",
  "CEREBRAS_MODEL",
  "NVIDIA_NIM_API_KEY",
  "NVIDIA_NIM_MODEL",
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

describe("getProviderConfig — auto mode sırası (Gemini → Groq → NVIDIA NIM → Cerebras → Heuristic)", () => {
  it("hiçbir anahtar yokken heuristic'e düşer", async () => {
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "heuristic", model: "heuristic" });
  });

  it("tüm anahtarlar mevcutken Gemini seçilir (1. sıra) ve varsayılan model gemini-2.5-flash'tır", async () => {
    process.env.GEMINI_API_KEY = "g-key";
    process.env.GROQ_API_KEY = "groq-key";
    process.env.NVIDIA_NIM_API_KEY = "nim-key";
    process.env.CEREBRAS_API_KEY = "cerebras-key";
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "gemini", model: "gemini-2.5-flash" });
  });

  it("Gemini eksikken Groq seçilir (2. sıra), varsayılan model llama-4-scout-17b", async () => {
    process.env.GROQ_API_KEY = "groq-key";
    process.env.NVIDIA_NIM_API_KEY = "nim-key";
    process.env.CEREBRAS_API_KEY = "cerebras-key";
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "groq", model: "llama-4-scout-17b" });
  });

  it("Gemini + Groq eksikken NVIDIA NIM seçilir (3. sıra), varsayılan model nemotron-3-ultra-550b-a55b", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-key";
    process.env.CEREBRAS_API_KEY = "cerebras-key";
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "nvidiaNim", model: "nemotron-3-ultra-550b-a55b" });
  });

  it("yalnızca Cerebras yapılandırılmışsa (4. sıra) o seçilir, varsayılan model gpt-oss-120b", async () => {
    process.env.CEREBRAS_API_KEY = "cerebras-key";
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "cerebras", model: "gpt-oss-120b" });
  });

  it("boşluktan ibaret bir anahtar eksik sayılır — bir sonraki configured provider'a geçilir", async () => {
    process.env.GEMINI_API_KEY = "   ";
    process.env.GROQ_API_KEY = "";
    process.env.NVIDIA_NIM_API_KEY = "nim-key";
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig().name).toBe("nvidiaNim");
  });

  it("explicit AI_PROVIDER=openai (auto zincirinde OLMASA da) hâlâ doğrudan seçilebilir — geriye dönük uyumluluk", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.GEMINI_API_KEY = "g-key"; // present but irrelevant — explicit selection wins
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "openai" });
  });

  it("explicit AI_PROVIDER=openai fakat anahtar yoksa heuristic'e düşer (asla sessizce başka bir provider'a kaymaz)", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.GEMINI_API_KEY = "g-key";
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "heuristic" });
  });

  it("explicit AI_PROVIDER=nvidianim (küçük harf) 'nvidiaNim' provider'ına doğru eşleşir — case-insensitive", async () => {
    process.env.AI_PROVIDER = "nvidianim";
    process.env.NVIDIA_NIM_API_KEY = "nim-key";
    const { getProviderConfig } = await import("../ai/config");
    expect(getProviderConfig()).toMatchObject({ name: "nvidiaNim", model: "nemotron-3-ultra-550b-a55b" });
  });
});
