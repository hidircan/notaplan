import type { ServiceContext } from "../services/context";
import type { AgentToolName } from "../agent/types";

export type WorkflowId =
  | "payment_reminders"
  | "lesson_reminders"
  | "attendance_followup"
  | "weekly_reports"
  | "teacher_utilization"
  | "makeup_suggestions";

export type WorkflowStepResult = {
  tool: AgentToolName;
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

export type WorkflowRunResult = {
  workflowId: WorkflowId;
  tenantId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  success: boolean;
  steps: WorkflowStepResult[];
  error?: string;
};

export type WorkflowDefinition = {
  id: WorkflowId;
  name: string;
  description: string;
  /** Cron-like human interval */
  intervalMinutes: number;
  defaultEnabled: boolean;
  /** Execute via Agent Runtime only — no DB */
  run: (ctx: ServiceContext) => Promise<WorkflowStepResult[]>;
};

export type WorkflowState = {
  id: WorkflowId;
  enabled: boolean;
  lastRunAt?: string;
  lastSuccess?: boolean;
  lastError?: string;
  runCount: number;
};
