/**
 * Turns (role, session, current-page entity) into a short list of ready-to-send
 * prompts. Every generated `message` embeds the real id in parentheses
 * (e.g. "Ayşe Yılmaz (s3) programı") so it resolves deterministically for
 * BOTH the heuristic fallback (its regex looks for `s\d+`/`t\d+` tokens) and
 * real LLM providers (which read the id straight off the text) — no backend
 * change, no hidden context injection, the sent message is exactly what the
 * user sees.
 */
import type { AppRole } from "@/lib/auth/types";
import type { AssistantEntity } from "./assistant-context";

export type QuickAction = { id: string; label: string; message: string };
export type AssistantSession = { role: AppRole; teacherId?: string; studentId?: string } | null;

const STAFF: AppRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "AI_AGENT"];

export function getQuickActions(session: AssistantSession, entity: AssistantEntity | null): QuickAction[] {
  const actions: QuickAction[] = [];
  const role = session?.role;

  if (entity?.kind === "student") {
    actions.push({
      id: "entity-student-schedule",
      label: "Programını göster",
      message: `${entity.label} (${entity.id}) programı`,
    });
    if (role && (STAFF.includes(role) || role === "PARENT")) {
      actions.push({
        id: "entity-student-balance",
        label: "Bakiyesini göster",
        message: `${entity.label} (${entity.id}) bakiyesi`,
      });
    }
  }

  if (entity?.kind === "teacher") {
    actions.push({
      id: "entity-teacher-schedule",
      label: "Programını göster",
      message: `${entity.label} (${entity.id}) programı`,
    });
  }

  // Session-based "kendim" shortcuts — useful even with no page entity
  // registered, since these never need the user to know/type an id.
  if (role === "TEACHER" && session?.teacherId && entity?.kind !== "teacher") {
    actions.push({
      id: "self-teacher-schedule",
      label: "Bugünkü programım",
      message: `${session.teacherId} programı`,
    });
  }
  if (role === "PARENT" && session?.studentId && entity?.kind !== "student") {
    actions.push({
      id: "self-student-schedule",
      label: "Çocuğumun programı",
      message: `${session.studentId} programı`,
    });
    actions.push({
      id: "self-student-balance",
      label: "Bakiyem ne kadar?",
      message: `${session.studentId} bakiyesi`,
    });
  }

  // Generic, role-appropriate defaults to fill out the list.
  if (role && STAFF.includes(role)) {
    actions.push(
      { id: "generic-teachers", label: "Gitar öğretmenlerini listele", message: "Gitar öğretmenlerini listele" },
      { id: "generic-collections", label: "Bu ayki tahsilat özeti", message: "Bu ayki tahsilat özetini göster" }
    );
  }
  if (role === "TEACHER") {
    actions.push({
      id: "generic-teacher-slots",
      label: "Uygun öğretmenler (Piyano)",
      message: "Piyano öğretmenlerini listele",
    });
  }
  actions.push({
    id: "generic-identity",
    label: "Hangi yapay zekasın?",
    message: "Hangi modelsin?",
  });

  // De-dupe by id, keep the most specific (entity-based) ones first.
  const seen = new Set<string>();
  return actions.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).slice(0, 5);
}
