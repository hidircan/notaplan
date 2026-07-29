/**
 * Offline fallback when no LLM API key is configured.
 */
import type { LlmProvider } from "../types";
import type { AgentToolName } from "../../agent/types";

function pickTool(
  text: string,
  allowed: Set<string>
): { tool: AgentToolName; input: unknown } | null {
  const t = text.toLowerCase();
  const tryTool = (name: AgentToolName, input: unknown) =>
    allowed.has(name) ? { tool: name, input } : null;

  if (
    /(öğretmen|ogretmen|teacher).*(liste|bul|müsait|musait|available)|available teacher|list teachers/i.test(
      t
    )
  ) {
    let instrument: string | undefined;
    if (t.includes("gitar")) instrument = "Gitar";
    if (t.includes("piyano")) instrument = "Piyano";
    if (t.includes("keman")) instrument = "Keman";
    if (t.includes("bateri")) instrument = "Bateri";
    if (t.includes("şan") || t.includes("vokal")) instrument = "Şan";
    if (t.includes("flüt") || t.includes("flut")) instrument = "Yan Flüt";
    return tryTool("findAvailableTeachers", { instrument });
  }

  const stu = t.match(/\b(s\d+|stu_[\w]+)\b/i);
  if (/program|schedule|dersleri/i.test(t) && stu) {
    return tryTool("getStudentSchedule", { studentId: stu[1] });
  }
  if (/program|schedule/i.test(t) && /\b(t\d+)\b/i.test(t)) {
    const m = t.match(/\b(t\d+)\b/i);
    return tryTool("getTeacherSchedule", { teacherId: m?.[1] || "t2" });
  }
  if (/bakiye|ödeme|odeme|balance|payment|borç/i.test(t)) {
    if (/ödendi|odendi|mark.*paid|tahsil/i.test(t)) {
      const p = t.match(/\b(p\d+)\b/i);
      return tryTool("createPayment", { paymentId: p?.[1] || "p5" });
    }
    return tryTool("getParentBalance", { studentId: stu?.[1] || "s1" });
  }
  if (/telafi.*slot|slot.*öner|slot.*oner|suggest.*makeup/i.test(t)) {
    const m = t.match(/\b(m\d+|mk_[\w]+)\b/i);
    return tryTool("findAvailableSlots", { requestId: m?.[1] || "m1" });
  }
  if (/yoklama|gelmedi|geldi|attendance|absent|present/i.test(t)) {
    const lesson = t.match(/\b(l\d+|l_[\w]+)\b/i);
    let status: "present" | "absent" | "cancelled_by_school" = "present";
    if (/gelmedi|absent/i.test(t)) status = "absent";
    if (/okul iptal|cancelled_by_school/i.test(t)) status = "cancelled_by_school";
    return tryTool("markAttendance", {
      lessonId: lesson?.[1] || "l8",
      status,
      reason: status === "absent" ? "AI chat kaydı" : undefined,
    });
  }
  return null;
}

export const heuristicProvider: LlmProvider = {
  name: "heuristic",

  async plan({ messages, tools }) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const text = lastUser?.content || "";
    const allowed = new Set(tools.map((t) => t.name));
    const call = pickTool(text, allowed);
    if (call) return { toolCalls: [call] };

    const catalog = tools.map((t) => `• ${t.name}: ${t.description}`).join("\n");
    return {
      assistantText:
        `Merhaba, NotaPlan asistanıyım (heuristic mod — API anahtarı yok).\n\n` +
        `Örnekler: "Gitar öğretmenlerini listele", "s1 bakiyesi", "m1 için telafi slot öner".\n\n` +
        `Araçlar:\n${catalog}`,
    };
  },

  async narrate({ userMessage, toolResults }) {
    if (!toolResults.length) return "İsteğinizi işledim.";
    const lines = toolResults.map((r) => {
      if (!r.ok) return `❌ ${r.tool}: ${r.error || "hata"}`;
      return `✅ ${r.tool}: ${JSON.stringify(r.data).slice(0, 400)}`;
    });
    return `İstek: “${userMessage}”\n\n${lines.join("\n")}\n\n(Agent Runtime üzerinden)`;
  },

  async streamNarrate(args, onToken) {
    const full = await this.narrate(args);
    for (let i = 0; i < full.length; i += 16) {
      onToken(full.slice(i, i + 16));
    }
    return full;
  },
};
