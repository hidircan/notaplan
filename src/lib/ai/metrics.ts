/**
 * Central AI metrics store — tenant-scoped, billing-ready.
 * Memory + file persistence (same pattern as conversations).
 */

import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { getProviderConfig, resolveChainProviderConfig } from "./config";
import { PROVIDER_CHAIN, type ProviderId } from "./provider-chain";

export type AiExecutionRecord = {
  id: string;
  at: string;
  conversationId?: string;
  tenantId: string;
  userId: string;
  provider: string;
  model: string;
  toolName?: string;
  phase: "plan" | "tool" | "narrate" | "turn";
  durationMs: number;
  success: boolean;
  error?: string;
  /** Prompt + completion tokens when provider reports them */
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  /** Estimated billable units (1 unit = 1 tool call or 1 LLM plan/narrate) */
  billableUnits: number;
};

export type ProviderHealth = {
  name: string;
  model: string;
  configured: boolean;
  status: "healthy" | "degraded" | "down" | "unknown";
  lastCheckedAt: string;
  latencyMs?: number;
  message?: string;
};

type StoreShape = {
  executions: AiExecutionRecord[];
  providerHealth: Record<string, ProviderHealth>;
};

const g = globalThis as unknown as { __notaplanAiMetrics?: StoreShape };

function mem(): StoreShape {
  if (!g.__notaplanAiMetrics) {
    g.__notaplanAiMetrics = { executions: [], providerHealth: {} };
  }
  return g.__notaplanAiMetrics;
}

function filePath() {
  return path.join(resolveDataDir(path.join(process.cwd(), "data")), "ai-metrics.json");
}

async function load(): Promise<StoreShape> {
  const m = mem();
  if (m.executions.length || Object.keys(m.providerHealth).length) return m;
  try {
    const raw = await fs.readFile(filePath(), "utf-8");
    const data = JSON.parse(raw) as StoreShape;
    g.__notaplanAiMetrics = data;
    return data;
  } catch {
    return m;
  }
}

async function save(data: StoreShape): Promise<void> {
  g.__notaplanAiMetrics = data;
  // Cap growth for demo hosts
  if (data.executions.length > 5000) {
    data.executions = data.executions.slice(0, 5000);
  }
  try {
    const dir = path.dirname(filePath());
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // memory still works
  }
}

export async function recordAiExecution(
  partial: Omit<AiExecutionRecord, "id" | "at" | "billableUnits"> & {
    billableUnits?: number;
  }
): Promise<AiExecutionRecord> {
  const data = await load();
  const rec: AiExecutionRecord = {
    id: `aix_${crypto.randomUUID().slice(0, 12)}`,
    at: new Date().toISOString(),
    billableUnits: partial.billableUnits ?? (partial.phase === "tool" ? 1 : 1),
    ...partial,
  };
  data.executions.unshift(rec);
  await save(data);
  return rec;
}

export async function listAiExecutions(opts: {
  tenantId: string;
  limit?: number;
}): Promise<AiExecutionRecord[]> {
  const data = await load();
  return data.executions
    .filter((e) => e.tenantId === opts.tenantId)
    .slice(0, opts.limit ?? 200);
}

export async function getAiDashboard(tenantId: string) {
  const data = await load();
  const rows = data.executions.filter((e) => e.tenantId === tenantId);
  const conversations = new Set(
    rows.map((r) => r.conversationId).filter(Boolean) as string[]
  );
  const toolCalls = rows.filter((r) => r.phase === "tool");
  const success = rows.filter((r) => r.success).length;
  const failed = rows.filter((r) => !r.success).length;
  const avgMs =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((s, r) => s + r.durationMs, 0) / rows.length);

  const providerUsage: Record<string, number> = {};
  for (const r of rows) {
    providerUsage[r.provider] = (providerUsage[r.provider] || 0) + 1;
  }

  const toolUsage: Record<string, number> = {};
  for (const r of toolCalls) {
    if (!r.toolName) continue;
    toolUsage[r.toolName] = (toolUsage[r.toolName] || 0) + 1;
  }

  const totalTokens = rows.reduce(
    (s, r) => s + (r.tokenUsage?.total || 0),
    0
  );
  const billableUnits = rows.reduce((s, r) => s + r.billableUnits, 0);

  return {
    totalExecutions: rows.length,
    totalConversations: conversations.size,
    totalToolCalls: toolCalls.length,
    successCount: success,
    errorCount: failed,
    successRate: rows.length ? Math.round((success / rows.length) * 1000) / 10 : 100,
    averageResponseTimeMs: avgMs,
    providerUsage,
    toolUsage,
    totalTokens,
    billableUnits,
    /** Future billing: price table multiplies these units */
    billingReady: true,
  };
}

export async function setProviderHealth(health: ProviderHealth): Promise<void> {
  const data = await load();
  data.providerHealth[health.name] = health;
  await save(data);
}

export async function getProviderHealthMap(): Promise<Record<string, ProviderHealth>> {
  const data = await load();
  return data.providerHealth;
}

/** Probe configured provider latency (lightweight). */
export async function checkProviderHealth(): Promise<ProviderHealth> {
  const cfg = getProviderConfig();
  const started = Date.now();
  const base: ProviderHealth = {
    name: cfg.name,
    model: cfg.model,
    configured: cfg.name !== "heuristic" || true,
    status: "unknown",
    lastCheckedAt: new Date().toISOString(),
  };

  if (cfg.name === "heuristic") {
    const health: ProviderHealth = {
      ...base,
      configured: true,
      status: "healthy",
      latencyMs: Date.now() - started,
      message: "Offline heuristic provider",
    };
    await setProviderHealth(health);
    return health;
  }

  if (!cfg.apiKey && cfg.name !== "local") {
    const health: ProviderHealth = {
      ...base,
      configured: false,
      status: "down",
      message: "API key missing",
      latencyMs: Date.now() - started,
    };
    await setProviderHealth(health);
    return health;
  }

  try {
    // Config presence + model string = configured; real ping optional
    const health: ProviderHealth = {
      ...base,
      configured: true,
      status: "healthy",
      latencyMs: Date.now() - started,
      message: `Configured (${cfg.model})`,
    };
    await setProviderHealth(health);
    return health;
  } catch (e) {
    const health: ProviderHealth = {
      ...base,
      configured: true,
      status: "down",
      latencyMs: Date.now() - started,
      message: e instanceof Error ? e.message : "Health check failed",
    };
    await setProviderHealth(health);
    return health;
  }
}

export type ChainProviderHealth = {
  id: ProviderId;
  configured: boolean;
  status: "healthy" | "unconfigured";
  model?: string;
  message: string;
};

/**
 * Presence-only health for EVERY provider in `PROVIDER_CHAIN` — distinct
 * from `checkProviderHealth()` above, which probes only the chat
 * orchestrator's single active provider. No live network ping (same
 * "config presence = configured" honesty as `checkProviderHealth()`), and
 * never includes API keys/tokens — only whether one is set and which model
 * would be used.
 */
export async function checkAllProviderHealth(): Promise<ChainProviderHealth[]> {
  return PROVIDER_CHAIN.map(({ id }): ChainProviderHealth => {
    const cfg = resolveChainProviderConfig(id);
    if (!cfg.configured) {
      return {
        id,
        configured: false,
        status: id === "heuristic" ? "healthy" : "unconfigured",
        message:
          id === "heuristic"
            ? "Offline heuristic provider"
            : "Gerekli API anahtarı/env değişkeni tanımlı değil.",
      };
    }
    return {
      id,
      configured: true,
      status: "healthy",
      model: "model" in cfg ? cfg.model : undefined,
      message: "Yapılandırılmış (env üzerinden).",
    };
  });
}
