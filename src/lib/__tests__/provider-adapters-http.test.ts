import { describe, it, expect, vi, afterEach } from "vitest";
import { createOpenAiCompatibleProvider } from "../ai/providers/openai-compatible";
import { createCloudflareWorkersAiProvider } from "../ai/providers/cloudflare-workers-ai";

/**
 * All HTTP calls here are mocked via `vi.stubGlobal("fetch", ...)` — no real
 * API key or network access is used or required.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_RETRY_COUNT;
});

describe("openai-compatible adapter — Groq/Cerebras/NVIDIA NIM için doğru baseUrl/model/key", () => {
  it("narrate() isteğini kendi baseUrl'sine, Bearer apiKey ile ve doğru model adıyla gönderir (Groq)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Groq cevabı" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "groq-secret",
      model: "llama-3.3-70b-versatile",
    });

    const text = await provider.narrate({ userMessage: "test", toolResults: [] });

    expect(text).toBe("Groq cevabı");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer groq-secret");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("llama-3.3-70b-versatile");
  });

  it("Cerebras için de kendi baseUrl/model/key ile çalışır", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Cerebras cevabı" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      name: "cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      apiKey: "cerebras-secret",
      model: "llama3.1-70b",
    });
    await provider.narrate({ userMessage: "test", toolResults: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer cerebras-secret");
    expect(JSON.parse(init.body).model).toBe("llama3.1-70b");
  });

  it("NVIDIA NIM için de kendi baseUrl/model/key ile çalışır", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "NIM cevabı" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      name: "nvidiaNim",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: "nim-secret",
      model: "meta/llama-3.1-70b-instruct",
    });
    await provider.narrate({ userMessage: "test", toolResults: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer nim-secret");
    expect(JSON.parse(init.body).model).toBe("meta/llama-3.1-70b-instruct");
  });

  it("HTTP hata durumunda LlmProviderError fırlatır (retry kapalı)", async () => {
    process.env.AI_RETRY_COUNT = "0";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "invalid api key" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "bad-key",
      model: "llama-3.3-70b-versatile",
    });

    await expect(provider.narrate({ userMessage: "test", toolResults: [] })).rejects.toThrow(
      /invalid api key/
    );
  });

  it("geçersiz anahtar hatası (401) AI_RETRY_COUNT > 0 olsa bile tekrar denenmez — aynı sağlayıcı, aynı anahtarla ikinci kez çağrılmaz", async () => {
    process.env.AI_RETRY_COUNT = "2";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "invalid api key" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "bad-key",
      model: "llama-4-scout-17b",
    });

    await expect(provider.narrate({ userMessage: "test", toolResults: [] })).rejects.toThrow(
      /invalid api key/
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("geçici bir hata (500) AI_RETRY_COUNT > 0 iken tekrar denenir — auth hatalarından farklı davranır", async () => {
    process.env.AI_RETRY_COUNT = "1";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "internal server error" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "good-key",
      model: "llama-4-scout-17b",
    });

    await expect(provider.narrate({ userMessage: "test", toolResults: [] })).rejects.toThrow(
      /internal server error/
    );
    // retries:1 → 1 ilk deneme + 1 tekrar = 2 çağrı
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Cloudflare Workers AI adapter — resmi REST sözleşmesi", () => {
  it("narrate() isteğini /accounts/:id/ai/run/:model'e, Bearer apiToken ile gönderir ve result.response'u döner", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { response: "Cloudflare cevabı" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createCloudflareWorkersAiProvider({
      accountId: "acc_123",
      apiToken: "cf-secret",
      model: "@cf/meta/llama-3.1-8b-instruct",
    });

    const text = await provider.narrate({ userMessage: "test", toolResults: [] });

    expect(text).toBe("Cloudflare cevabı");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acc_123/ai/run/@cf/meta/llama-3.1-8b-instruct"
    );
    expect(init.headers.Authorization).toBe("Bearer cf-secret");
  });

  it("success:false döndüğünde LlmProviderError fırlatır (retry kapalı)", async () => {
    process.env.AI_RETRY_COUNT = "0";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, errors: [{ message: "model not found" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createCloudflareWorkersAiProvider({
      accountId: "acc_123",
      apiToken: "cf-secret",
      model: "@cf/does/not-exist",
    });

    await expect(provider.narrate({ userMessage: "test", toolResults: [] })).rejects.toThrow(
      /model not found/
    );
  });

  it("plan() tool-calling denemez — yalnızca metin döner (assistantText)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { response: "merhaba" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createCloudflareWorkersAiProvider({
      accountId: "acc_123",
      apiToken: "cf-secret",
      model: "@cf/meta/llama-3.1-8b-instruct",
    });

    const plan = await provider.plan({ messages: [{ role: "user", content: "merhaba" }], tools: [] });
    expect(plan.toolCalls).toBeUndefined();
    expect(plan.assistantText).toBe("merhaba");
  });
});
