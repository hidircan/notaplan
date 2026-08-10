import type { AgentToolName } from "../../agent/types";

export type PlanStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type PlanFailureMode = "stop" | "skip" | "replan";

export type PlanStep = {
  id: string;
  objective: string;
  tool: AgentToolName;
  input: unknown;
  dependsOn?: string[];
  condition?: "always" | "previous_success";
  maxRetries?: number;
  onFailure?: PlanFailureMode;
  status: PlanStepStatus;
};

export type AgentPlan = {
  id: string;
  conversationId: string;
  objective: string;
  steps: PlanStep[];
  createdAt: string;
  revision: number;
};
