import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
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

export async function listWorkflowStates(): Promise<WorkflowState[]> {
  const data = await load();
  return Object.keys(WORKFLOW_REGISTRY).map((id) => {
    const wid = id as WorkflowId;
    return data.states[wid] || defaultState(wid);
  });
}

export async function getWorkflowState(id: WorkflowId): Promise<WorkflowState> {
  const data = await load();
  return data.states[id] || defaultState(id);
}

export async function setWorkflowEnabled(
  id: WorkflowId,
  enabled: boolean
): Promise<WorkflowState> {
  const data = await load();
  const cur = data.states[id] || defaultState(id);
  const next = { ...cur, enabled };
  data.states[id] = next;
  await save(data);
  return next;
}

export async function recordWorkflowRun(run: WorkflowRunResult): Promise<void> {
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

export async function listWorkflowRuns(limit = 50): Promise<WorkflowRunResult[]> {
  const data = await load();
  return data.runs.slice(0, limit);
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
