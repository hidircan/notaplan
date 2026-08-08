import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { PageHeader } from "@/components/ui";
import { listTasksTool } from "@/lib/services";
import { TaskKanbanBoard } from "@/components/task-kanban-board";

export const dynamic = "force-dynamic";

/**
 * İş Takip Kanban görünümü (admin) — Faz 2 madde 1. Aynı `listTasksTool`/
 * `changeTaskStatusTool`'u kullanır, ayrı bir veri yolu YOK.
 */
export default async function IsTakipKanbanPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/is-takip/kanban");
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);
  const listRes = await listTasksTool(session, {});
  // Arşiv Kanban tahtasında gösterilmez — ayrı bir görünüm/filtredir.
  const tasks = listRes.ok ? listRes.data.tasks.filter((t) => t.status !== "ARCHIVED") : [];
  const assigneeLabels = Object.fromEntries(data.teachers.map((t) => [t.id, t.name]));

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <PageHeader
        title="İş Takip — Kanban"
        description="Görevleri durumlarına göre sürükleyip bırakmak yerine, her kartın altındaki menüden durumunu değiştirin."
        actions={
          <Link href="/panel/is-takip" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            ← Liste görünümü
          </Link>
        }
      />
      <TaskKanbanBoard tasks={tasks} isAdmin assigneeLabels={assigneeLabels} />
    </div>
  );
}
