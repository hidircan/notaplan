import type { z } from "zod";
import type { AppRole } from "../auth/types";
import type { ServiceContext } from "../services/context";
import type { ServiceResult } from "../services/result";

/** Future channels that will use this runtime */
export type AgentChannel =
  | "web_chat"
  | "whatsapp"
  | "voice"
  | "mobile"
  | "mcp"
  | "api";

export type AgentToolName =
  | "markAttendance"
  | "findAvailableSlots"
  | "confirmMakeupLesson"
  | "createMakeupLesson"
  | "cancelMakeupLesson"
  | "findAvailableTeachers"
  | "getStudentSchedule"
  | "getTeacherSchedule"
  | "getParentBalance"
  | "createPayment"
  | "sendParentMessage"
  | "sendTeacherMessage"
  | "createStudent"
  | "createTeacher"
  | "resetDemo";

export type ToolDefinition<TIn = unknown, TOut = unknown> = {
  name: AgentToolName;
  description: string;
  /** JSON Schema-ish description for LLM/MCP (zod converted) */
  inputSchema: z.ZodType<TIn>;
  /** Optional output shape documentation (not always strictly enforced) */
  outputSchema?: z.ZodType<TOut>;
  /** Roles allowed to invoke via agent runtime (in addition to tool-level checks) */
  requiredRoles: AppRole[];
  /** Never touches DB — always delegates to Tool Layer */
  execute: (ctx: ServiceContext, input: TIn) => Promise<ServiceResult<TOut>>;
};

export type AgentExecuteRequest = {
  tool: AgentToolName;
  input?: unknown;
  /** Correlation for conversation history */
  conversationId?: string;
  messageId?: string;
  channel?: AgentChannel;
};

export type AgentExecuteSuccess<T = unknown> = {
  ok: true;
  data: {
    tool: AgentToolName;
    result: T;
    conversationId?: string;
    messageId?: string;
    requestId: string;
  };
};

export type AgentExecuteFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  conversationId?: string;
  messageId?: string;
  requestId: string;
};

export type AgentExecuteResponse<T = unknown> =
  | AgentExecuteSuccess<T>
  | AgentExecuteFailure;

export type AgentLogEvent = {
  type: "agent.tool_call" | "agent.tool_result" | "agent.tool_denied" | "agent.error";
  requestId: string;
  conversationId?: string;
  messageId?: string;
  channel?: AgentChannel;
  userId?: string;
  tenantId?: string;
  role?: AppRole;
  tool?: AgentToolName;
  input?: unknown;
  outcome: "success" | "denied" | "error";
  error?: string;
  meta?: Record<string, unknown>;
  at: string;
};
