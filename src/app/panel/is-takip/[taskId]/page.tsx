import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { EmptyState, PageHeader } from "@/components/ui";
import { BackButton } from "@/components/back-button";
import { getTaskDetailTool } from "@/lib/services";
import { TaskDetailPanel } from "@/components/task-detail-panel";

export const dynamic = "force-dynamic";

export default async function IsTakipDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/panel/is-takip/${taskId}`);
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);

  const detailRes = await getTaskDetailTool(session, { taskId });

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <BackButton fallbackHref="/panel/is-takip" label="İş Takip'e dön" className="mb-3" />
      {!detailRes.ok ? (
        <>
          <PageHeader title="Görev bulunamadı" />
          <EmptyState
            title="Görev bulunamadı"
            description="Bu görev kurumunuzda kayıtlı değil veya kaldırılmış olabilir."
          />
        </>
      ) : (
        <TaskDetailPanel
          task={detailRes.data.task}
          checklist={detailRes.data.checklist}
          comments={detailRes.data.comments}
          activity={detailRes.data.activity}
          isAdmin
          assigneeLabel={data.teachers.find((t) => t.id === detailRes.data.task.assigneeId)?.name}
        />
      )}
    </div>
  );
}
