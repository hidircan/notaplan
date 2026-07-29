import type { AgentToolName } from "../agent/types";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  toolName?: AgentToolName;
  toolStatus?: "pending" | "success" | "error";
  toolResult?: unknown;
  toolError?: string;
};

export type Conversation = {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type LlmProviderName =
  | "heuristic"
  | "openai"
  | "grok"
  | "claude"
  | "gemini"
  | "local";

export type LlmToolCall = {
  tool: AgentToolName;
  input: unknown;
};

export type LlmPlan = {
  assistantText?: string;
  toolCalls?: LlmToolCall[];
};

export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
};

export type ToolDescriptor = {
  name: string;
  description: string;
  requiredRoles: string[];
  inputSchema?: Record<string, unknown>;
};

export type LlmProvider = {
  name: LlmProviderName;
  /** Plan tool calls / direct reply. Must NOT execute tools or touch DB. */
  plan: (args: {
    messages: LlmMessage[];
    tools: ToolDescriptor[];
  }) => Promise<LlmPlan>;
  /** Natural language summary of tool results */
  narrate: (args: {
    userMessage: string;
    toolResults: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>;
  }) => Promise<string>;
  /** Optional token streaming for final assistant text */
  streamNarrate?: (
    args: {
      userMessage: string;
      toolResults: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>;
    },
    onToken: (token: string) => void
  ) => Promise<string>;
};

export type ChatStreamEvent =
  | { type: "meta"; conversationId: string; provider: string }
  | { type: "tool_start"; tool: string; messageId: string }
  | { type: "tool_end"; tool: string; messageId: string; ok: boolean; content: string }
  | { type: "token"; text: string }
  | {
      type: "done";
      conversationId: string;
      messages: ChatMessage[];
      assistantMessage: ChatMessage;
      provider: string;
    }
  | { type: "error"; message: string };
