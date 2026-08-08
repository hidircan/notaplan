import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSessionContext } from "@/lib/auth/session";
import { Card, EmptyState } from "@/components/ui";
import { getTaskDetailTool } from "@/lib/services";
import { TaskDetailPanel } from "@/components/task-detail-panel";

export const dynamic = "force-dynamic";

export default async function OgretmenIsTakipDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/ogretmen/is-takip/${taskId}`);
  }
  if (session.role !== "TEACHER") redirect("/panel");

  const detailRes = await getTaskDetailTool(session, { taskId });

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-slate-50">
      <header className="border-b border-cyan-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Link href="/ogretmen/is-takip" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" /> İş Takip
          </Link>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Görev Detayı</p>
          <span className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
        {!detailRes.ok ? (
          <Card>
            <EmptyState
              title="Görev bulunamadı"
              description="Bu görev size atanmamış/takipçisi değilsiniz ya da kaldırılmış olabilir."
            />
          </Card>
        ) : (
          <Card>
            <TaskDetailPanel
              task={detailRes.data.task}
              checklist={detailRes.data.checklist}
              comments={detailRes.data.comments}
              activity={detailRes.data.activity}
              isAdmin={false}
              currentActorIds={[session.userId, session.teacherId].filter((v): v is string => !!v)}
            />
          </Card>
        )}
      </main>
    </div>
  );
}
