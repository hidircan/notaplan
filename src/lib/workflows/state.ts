import { promises as fs } from "fs";
import path from "path";
import type { Prisma } from "@prisma/client";
import { isDbMode, resolveDataDir } from "../config";
import type { WorkflowId, WorkflowRunResult, WorkflowState } from "./types";
import { WORKFLOW_REGISTRY } from "./registry";

type StoreShape = {
  states: Record<string, WorkflowState>;
  runs: WorkflowRunResult[];
};

const g = globalThis as unknown as { __notaplanWorkflows?: StoreShape };

function mem(): StoreShape {
  if (!g.__notaplanWorkflows) {
    g.__notaplanWorkflows = { states: {}, runs: [] };
  }
  return g.__notaplanWorkflows;
}

function filePath() {
  return path.join(resolveDataDir(path.join(process.cwd(), "data")), "workflows.json");
}

/** Resolved store path — exposed so tests clean up the same file the module writes. */
export const WORKFLOWS_FILE = filePath();

async function load(): Promise<StoreShape> {
  const m = mem();
  if (Object.keys(m.states).length) return m;
  try {
    const raw = await fs.readFile(filePath(), "utf-8");
    const data = JSON.parse(raw) as StoreShape;
    g.__notaplanWorkflows = data;
    return data;
  } catch {
    return m;
  }
}

async function save(data: StoreShape): Promise<void> {
  g.__notaplanWorkflows = data;
  if (data.runs.length > 500) data.runs = data.runs.slice(0, 500);
  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(data, null, 2), "utf-8");
  } catch {
    /* memory ok */
  }
}

function defaultState(id: WorkflowId): WorkflowState {
  const def = WORKFLOW_REGISTRY[id];
  return {
    id,
    enabled: def?.defaultEnabled ?? false,
    runCount: 0,
  };
}

type DbWorkflowState = {
  id: string;
  enabled: boolean;
  lastRunAt: Date | null;
  lastSuccess: boolean | null;
  lastError: string | null;
  runCount: number;
};

function mapDbState(row: DbWorkflowState): WorkflowState {
  return {
    id: row.id as WorkflowId,
    enabled: row.enabled,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : undefined,
    lastSuccess: row.lastSuccess ?? undefined,
    lastError: row.lastError ?? undefined,
    runCount: row.runCount,
  };
}

async function listWorkflowStatesDb(): Promise<WorkflowState[]> {
  const { prisma } = await import("../db");
  const rows = await prisma.workflowState.findMany();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return Object.keys(WORKFLOW_REGISTRY).map((id) => {
    const wid = id as WorkflowId;
    const row = byId.get(id);
    return row ? mapDbState(row) : defaultState(wid);
  });
}

async function getWorkflowStateDb(id: WorkflowId): Promise<WorkflowState> {
  const { prisma } = await import("../db");
  const row = await prisma.workflowState.findUnique({ where: { id } });
  return row ? mapDbState(row) : defaultState(id);
}

async function setWorkflowEnabledDb(
  id: WorkflowId,
  enabled: boolean
): Promise<WorkflowState> {
  const { prisma } = await import("../db");
  const cur = await getWorkflowStateDb(id);
  await prisma.workflowState.upsert({
    where: { id },
    create: {
      id,
      enabled,
      runCount: cur.runCount,
      lastRunAt: cur.lastRunAt ? new Date(cur.lastRunAt) : null,
      lastSuccess: cur.lastSuccess ?? null,
      lastError: cur.lastError ?? null,
    },
    update: { enabled },
  });
  return { ...cur, enabled };
}

async function recordWorkflowRunDb(run: WorkflowRunResult): Promise<void> {
  const { prisma } = await import("../db");
  const cur = await getWorkflowStateDb(run.workflowId);
  await prisma.$transaction([
    prisma.workflowRun.create({
      data: {
        id: `run_${crypto.randomUUID().slice(0, 8)}`,
        workflowId: run.workflowId,
        tenantId: run.tenantId,
        startedAt: new Date(run.startedAt),
        finishedAt: new Date(run.finishedAt),
        durationMs: run.durationMs,
        success: run.success,
        steps: JSON.parse(JSON.stringify(run.steps)) as Prisma.InputJsonValue,
        error: run.error ?? null,
      },
    }),
    prisma.workflowState.upsert({
      where: { id: run.workflowId },
      create: {
        id: run.workflowId,
        enabled: cur.enabled,
        lastRunAt: new Date(run.finishedAt),
        lastSuccess: run.success,
        lastError: run.error ?? null,
        runCount: cur.runCount + 1,
      },
      update: {
        lastRunAt: new Date(run.finishedAt),
        lastSuccess: run.success,
        lastError: run.error ?? null,
        runCount: { increment: 1 },
      },
    }),
  ]);
}

async function listWorkflowRunsDb(
  tenantId: string,
  limit = 50
): Promise<WorkflowRunResult[]> {
  const { prisma } = await import("../db");
  const rows = await prisma.workflowRun.findMany({
    where: { tenantId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    workflowId: row.workflowId as WorkflowId,
    tenantId: row.tenantId,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt.toISOString(),
    durationMs: row.durationMs,
    success: row.success,
    steps: row.steps as WorkflowRunResult["steps"],
    error: row.error ?? undefined,
  }));
}

export async function listWorkflowStates(): Promise<WorkflowState[]> {
  if (isDbMode) return listWorkflowStatesDb();
  const data = await load();
  return Object.keys(WORKFLOW_REGISTRY).map((id) => {
    const wid = id as WorkflowId;
    return data.states[wid] || defaultState(wid);
  });
}

export async function getWorkflowState(id: WorkflowId): Promise<WorkflowState> {
  if (isDbMode) return getWorkflowStateDb(id);
  const data = await load();
  return data.states[id] || defaultState(id);
}

export async function setWorkflowEnabled(
  id: WorkflowId,
  enabled: boolean
): Promise<WorkflowState> {
  if (isDbMode) return setWorkflowEnabledDb(id, enabled);
  const data = await load();
  const cur = data.states[id] || defaultState(id);
  const next = { ...cur, enabled };
  data.states[id] = next;
  await save(data);
  return next;
}

export async function recordWorkflowRun(run: WorkflowRunResult): Promise<void> {
  if (isDbMode) return recordWorkflowRunDb(run);
  const data = await load();
  const cur = data.states[run.workflowId] || defaultState(run.workflowId);
  data.states[run.workflowId] = {
    ...cur,
    lastRunAt: run.finishedAt,
    lastSuccess: run.success,
    lastError: run.error,
    runCount: (cur.runCount || 0) + 1,
  };
  data.runs.unshift(run);
  await save(data);
}

export async function listWorkflowRuns(
  tenantId: string,
  limit = 50
): Promise<WorkflowRunResult[]> {
  if (isDbMode) return listWorkflowRunsDb(tenantId, limit);
  const data = await load();
  return data.runs.filter((r) => r.tenantId === tenantId).slice(0, limit);
}

export async function isDue(id: WorkflowId, now = Date.now()): Promise<boolean> {
  const def = WORKFLOW_REGISTRY[id];
  if (!def) return false;
  const state = await getWorkflowState(id);
  if (!state.enabled) return false;
  if (!state.lastRunAt) return true;
  const elapsed = now - new Date(state.lastRunAt).getTime();
  return elapsed >= def.intervalMinutes * 60_000;
}
