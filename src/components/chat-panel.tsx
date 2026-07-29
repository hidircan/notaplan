"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, Wrench } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";

type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  toolStatus?: "pending" | "success" | "error";
};

type ConvSummary = { id: string; title: string; updatedAt: string; messageCount: number };

type StreamEvent =
  | { type: "meta"; conversationId: string; provider: string }
  | { type: "tool_start"; tool: string; messageId: string }
  | { type: "tool_end"; tool: string; messageId: string; ok: boolean; content: string }
  | { type: "token"; text: string }
  | {
      type: "done";
      conversationId: string;
      messages: UiMessage[];
      assistantMessage: UiMessage;
      provider: string;
    }
  | { type: "error"; message: string };

export function ChatPanel() {
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/v1/chat", { credentials: "include" });
    const json = await res.json();
    if (json.ok) setConversations(json.data.conversations || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/v1/chat", { credentials: "include" });
      const json = await res.json();
      if (!cancelled && json.ok) {
        setConversations(json.data.conversations || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamingText]);

  async function loadConversation(id: string) {
    setError(null);
    const res = await fetch(`/api/v1/chat/${id}`, { credentials: "include" });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error?.message || "Sohbet yüklenemedi");
      return;
    }
    setConversationId(id);
    setMessages(json.data.conversation.messages || []);
    setStreamingText("");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setError(null);
    setStreamingText("");
    setMessages((m) => [
      ...m,
      { id: `local_${Date.now()}`, role: "user", content: text },
    ]);

    try {
      const res = await fetch("/api/v1/chat/stream", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok || !res.body) {
        // fallback non-stream
        const fallback = await fetch("/api/v1/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, conversationId }),
        });
        const json = await fallback.json();
        if (!json.ok) {
          setError(json.error?.message || "İstek başarısız");
          setLoading(false);
          return;
        }
        setConversationId(json.data.conversationId);
        setProvider(json.data.provider);
        setMessages(json.data.messages || []);
        await loadList();
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let liveAssistant = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          let event: StreamEvent;
          try {
            event = JSON.parse(payload) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === "meta") {
            setConversationId(event.conversationId);
            setProvider(event.provider);
          } else if (event.type === "tool_start") {
            setMessages((m) => [
              ...m,
              {
                id: event.messageId,
                role: "tool",
                content: `Çalıştırılıyor: ${event.tool}…`,
                toolName: event.tool,
                toolStatus: "pending",
              },
            ]);
          } else if (event.type === "tool_end") {
            setMessages((m) => [
              ...m.filter((x) => !(x.toolName === event.tool && x.toolStatus === "pending")),
              {
                id: event.messageId,
                role: "tool",
                content: event.content,
                toolName: event.tool,
                toolStatus: event.ok ? "success" : "error",
              },
            ]);
          } else if (event.type === "token") {
            liveAssistant += event.text;
            setStreamingText(liveAssistant);
          } else if (event.type === "done") {
            setConversationId(event.conversationId);
            setProvider(event.provider);
            setMessages(event.messages || []);
            setStreamingText("");
            await loadList();
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setConversationId(undefined);
    setMessages([]);
    setStreamingText("");
    setError(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="flex max-h-[70vh] flex-col !p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sohbetler
          </p>
          <button
            type="button"
            onClick={newChat}
            className="text-xs font-medium text-violet-600 hover:underline"
          >
            Yeni
          </button>
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => loadConversation(c.id)}
                className={`w-full rounded-lg px-2 py-2 text-left text-xs transition ${
                  conversationId === c.id
                    ? "bg-violet-100 text-violet-900"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="line-clamp-2 font-medium">{c.title}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  {c.messageCount} mesaj
                </span>
              </button>
            </li>
          ))}
          {!conversations.length ? (
            <li className="px-1 text-xs text-slate-400">Henüz sohbet yok</li>
          ) : null}
        </ul>
      </Card>

      <Card className="flex h-[70vh] flex-col !p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">NotaPlan Asistan</p>
            <p className="text-[11px] text-slate-500">
              Streaming · Agent Runtime
              {provider ? ` · ${provider}` : ""}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {!messages.length && !streamingText ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              <Bot className="mx-auto mb-2 h-8 w-8 text-violet-400" />
              Üretim LLM (OpenAI / Grok / Gemini) veya heuristic fallback. Örn: “Gitar
              öğretmenlerini listele”.
            </div>
          ) : null}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-violet-600 text-white"
                    : m.role === "tool"
                      ? "border border-amber-200 bg-amber-50 text-amber-950"
                      : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.role === "tool" ? (
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    <Wrench className="h-3 w-3" />
                    {m.toolName} · {m.toolStatus || "tool"}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}

          {streamingText ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-800">
                <p className="whitespace-pre-wrap">{streamingText}</p>
              </div>
            </div>
          ) : null}

          {loading && !streamingText ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Düşünülüyor / araç çalışıyor…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <p className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <form
          className="flex gap-2 border-t border-slate-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mesajınızı yazın…"
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
            Gönder
          </Button>
        </form>
      </Card>
    </div>
  );
}
