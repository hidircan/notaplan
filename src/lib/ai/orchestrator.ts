/**
 * Chat orchestrator — LLM plans, Agent Runtime executes tools.
 * No direct DB. Tools only via executeAgentTool().
 */

import type { ServiceContext } from "../services/context";
import { executeAgentTool, listToolsForRole } from "../agent";
import { getLlmProvider } from "./provider-factory";
import {
  appendMessages,
  createConversation,
  getConversation,
  newMessage,
} from "./conversations";
import type { ChatMessage, ChatStreamEvent, Conversation } from "./types";
import { LlmProviderError, getProviderConfig } from "./config";
import type { AgentToolName } from "../agent/types";
import { recordAiExecution } from "./metrics";
import { withRetry } from "./retry";

export type ChatTurnResult = {
  conversation: Conversation;
  assistantMessage: ChatMessage;
  toolMessages: ChatMessage[];
  provider: string;
};

async function prepareTurn(args: {
  ctx: ServiceContext;
  conversationId?: string;
  message: string;
}) {
  const { ctx } = args;
  const text = args.message.trim();
  if (!text) throw new Error("Empty message");

  let conversation =
    (args.conversationId &&
      (await getConversation(ctx.tenantId, ctx.userId, args.conversationId))) ||
    null;

  if (!conversation) {
    conversation = await createConversation(ctx.tenantId, ctx.userId, text.slice(0, 48));
  }

  const userMsg = newMessage("user", text);
  await appendMessages(ctx.tenantId, ctx.userId, conversation.id, [userMsg]);

  const provider = getLlmProvider();
  const tools = listToolsForRole(ctx.role).map((t) => ({
    name: t.name,
    description: t.description,
    requiredRoles: t.requiredRoles,
    inputSchema: t.inputSchema,
  }));

  // Short-term: last messages · Long-term: Memory Layer (tenant/user/workflow)
  const { retrieveRelevantMemories, formatMemoriesForPrompt } = await import("./memory");
  const memories = await retrieveRelevantMemories({
    ctx,
    conversationId: conversation.id,
    queryText: text,
    limit: 10,
  });
  const memoryBlock = formatMemoriesForPrompt(memories);

  const history = conversation.messages
    .concat(userMsg)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (memoryBlock) {
    history.unshift({
      role: "assistant",
      content: `[MEMORY CONTEXT]\n${memoryBlock}`,
    });
  }

  return { text, conversation, userMsg, provider, tools, history, ctx, memories };
}

async function runTools(
  ctx: ServiceContext,
  conversationId: string,
  planCalls: Array<{ tool: AgentToolName; input: unknown }>,
  onEvent?: (e: ChatStreamEvent) => void
) {
  const toolMessages: ChatMessage[] = [];
  const toolResults: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }> =
    [];

  const cfg = getProviderConfig();
  for (const call of planCalls) {
    const pending = newMessage("tool", `Çalıştırılıyor: ${call.tool}…`, {
      toolName: call.tool,
      toolStatus: "pending",
    });
    onEvent?.({ type: "tool_start", tool: call.tool, messageId: pending.id });

    const t0 = Date.now();
    const exec = await executeAgentTool(
      { ...ctx, channel: "chat", requestId: pending.id },
      {
        tool: call.tool,
        input: call.input,
        conversationId,
        messageId: pending.id,
        channel: "web_chat",
      }
    );
    const durationMs = Date.now() - t0;

    void recordAiExecution({
      conversationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: cfg.name,
      model: cfg.model,
      toolName: call.tool,
      phase: "tool",
      durationMs,
      success: exec.ok,
      error: exec.ok ? undefined : exec.error.message,
      billableUnits: 1,
    });

    if (exec.ok) {
      const done = newMessage("tool", `Araç tamamlandı: ${call.tool}`, {
        toolName: call.tool,
        toolStatus: "success",
        toolResult: exec.data.result,
      });
      toolMessages.push(done);
      toolResults.push({ tool: call.tool, ok: true, data: exec.data.result });
      onEvent?.({
        type: "tool_end",
        tool: call.tool,
        messageId: done.id,
        ok: true,
        content: done.content,
      });
    } else {
      const fail = newMessage("tool", `Araç hatası: ${call.tool} — ${exec.error.message}`, {
        toolName: call.tool,
        toolStatus: "error",
        toolError: exec.error.message,
      });
      toolMessages.push(fail);
      toolResults.push({ tool: call.tool, ok: false, error: exec.error.message });
      onEvent?.({
        type: "tool_end",
        tool: call.tool,
        messageId: fail.id,
        ok: false,
        content: fail.content,
      });
    }
  }

  return { toolMessages, toolResults };
}

export async function runChatTurn(args: {
  ctx: ServiceContext;
  conversationId?: string;
  message: string;
}): Promise<ChatTurnResult> {
  const prep = await prepareTurn(args);
  let { conversation } = prep;
  const { text, provider, tools, history, ctx } = prep;

  const cfg = getProviderConfig();
  let plan;
  const planT0 = Date.now();
  try {
    plan = await withRetry(() => provider.plan({ messages: history, tools }), {
      label: "llm.plan",
      timeoutMs: cfg.timeoutMs,
    });
    void recordAiExecution({
      conversationId: conversation.id,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: provider.name,
      model: cfg.model,
      phase: "plan",
      durationMs: Date.now() - planT0,
      success: true,
      billableUnits: 1,
    });
  } catch (e) {
    void recordAiExecution({
      conversationId: conversation.id,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: provider.name,
      model: cfg.model,
      phase: "plan",
      durationMs: Date.now() - planT0,
      success: false,
      error: e instanceof Error ? e.message : "plan failed",
      billableUnits: 1,
    });
    const msg =
      e instanceof LlmProviderError
        ? `LLM hatası (${e.provider}): ${e.message}`
        : e instanceof Error
          ? e.message
          : "LLM plan failed";
    const assistantMessage = newMessage("assistant", msg);
    conversation = await appendMessages(ctx.tenantId, ctx.userId, conversation.id, [
      assistantMessage,
    ]);
    return { conversation, assistantMessage, toolMessages: [], provider: provider.name };
  }

  const { toolMessages, toolResults } = await runTools(
    ctx,
    conversation.id,
    plan.toolCalls || []
  );

  let assistantText = plan.assistantText;
  try {
    if (toolResults.length) {
      const n0 = Date.now();
      assistantText = await withRetry(
        () => provider.narrate({ userMessage: text, toolResults }),
        { label: "llm.narrate", timeoutMs: cfg.timeoutMs }
      );
      void recordAiExecution({
        conversationId: conversation.id,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        provider: provider.name,
        model: cfg.model,
        phase: "narrate",
        durationMs: Date.now() - n0,
        success: true,
        billableUnits: 1,
      });
    }
  } catch (e) {
    void recordAiExecution({
      conversationId: conversation.id,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: provider.name,
      model: cfg.model,
      phase: "narrate",
      durationMs: 0,
      success: false,
      error: e instanceof Error ? e.message : "narrate failed",
      billableUnits: 1,
    });
    assistantText =
      toolResults.length > 0
        ? `Araçlar çalıştı ancak özetleme başarısız: ${e instanceof Error ? e.message : "hata"}`
        : plan.assistantText;
  }

  if (!assistantText) {
    assistantText = toolResults.length
      ? "İşlem tamamlandı."
      : "Size nasıl yardımcı olabilirim?";
  }

  const assistantMessage = newMessage("assistant", assistantText);
  conversation = await appendMessages(ctx.tenantId, ctx.userId, conversation.id, [
    ...toolMessages,
    assistantMessage,
  ]);

  // Post-turn memory update (facts / preferences / summaries)
  const { updateMemoryAfterTurn } = await import("./memory");
  void updateMemoryAfterTurn({
    ctx,
    conversationId: conversation.id,
    userMessage: text,
    assistantMessage: assistantText,
    toolNames: toolMessages.map((m) => m.toolName).filter(Boolean) as string[],
  });

  return {
    conversation,
    assistantMessage,
    toolMessages,
    provider: provider.name,
  };
}

/** Streaming chat turn for web SSE */
export async function* streamChatTurn(args: {
  ctx: ServiceContext;
  conversationId?: string;
  message: string;
}): AsyncGenerator<ChatStreamEvent> {
  try {
    const prep = await prepareTurn(args);
    let { conversation } = prep;
    const { text, provider, tools, history, ctx } = prep;

    yield {
      type: "meta",
      conversationId: conversation.id,
      provider: provider.name,
    };

    let plan;
    try {
      plan = await provider.plan({ messages: history, tools });
    } catch (e) {
      yield {
        type: "error",
        message:
          e instanceof LlmProviderError
            ? `LLM hatası (${e.provider}): ${e.message}`
            : e instanceof Error
              ? e.message
              : "LLM plan failed",
      };
      return;
    }

    const streamEvents: ChatStreamEvent[] = [];
    const { toolMessages, toolResults } = await runTools(
      ctx,
      conversation.id,
      plan.toolCalls || [],
      (e) => streamEvents.push(e)
    );
    for (const e of streamEvents) yield e;

    let assistantText = plan.assistantText || "";

    if (toolResults.length && provider.streamNarrate) {
      const tokens: string[] = [];
      try {
        assistantText = await provider.streamNarrate(
          { userMessage: text, toolResults },
          (token) => tokens.push(token)
        );
      } catch (e) {
        assistantText = await provider.narrate({ userMessage: text, toolResults }).catch(
          () => `Araçlar tamamlandı. Özet hatası: ${e instanceof Error ? e.message : "hata"}`
        );
        tokens.length = 0;
      }
      if (tokens.length) {
        for (const t of tokens) yield { type: "token", text: t };
      } else {
        for (let i = 0; i < assistantText.length; i += 12) {
          yield { type: "token", text: assistantText.slice(i, i + 12) };
        }
      }
    } else {
      if (toolResults.length) {
        try {
          assistantText = await provider.narrate({ userMessage: text, toolResults });
        } catch {
          /* keep plan text */
        }
      }
      if (!assistantText) {
        assistantText = toolResults.length
          ? "İşlem tamamlandı."
          : "Size nasıl yardımcı olabilirim?";
      }
      for (let i = 0; i < assistantText.length; i += 12) {
        yield { type: "token", text: assistantText.slice(i, i + 12) };
      }
    }

    if (!assistantText) assistantText = "İşlem tamamlandı.";

    const assistantMessage = newMessage("assistant", assistantText);
    conversation = await appendMessages(ctx.tenantId, ctx.userId, conversation.id, [
      ...toolMessages,
      assistantMessage,
    ]);

    const { updateMemoryAfterTurn } = await import("./memory");
    void updateMemoryAfterTurn({
      ctx,
      conversationId: conversation.id,
      userMessage: text,
      assistantMessage: assistantText,
      toolNames: toolMessages.map((m) => m.toolName).filter(Boolean) as string[],
    });

    yield {
      type: "done",
      conversationId: conversation.id,
      messages: conversation.messages,
      assistantMessage,
      provider: provider.name,
    };
  } catch (e) {
    yield {
      type: "error",
      message: e instanceof Error ? e.message : "Chat stream failed",
    };
  }
}
