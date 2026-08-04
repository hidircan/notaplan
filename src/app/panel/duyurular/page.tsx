import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { listAllAnnouncementsTool } from "@/lib/services";
import { readData } from "@/lib/store";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AnnouncementForm } from "@/components/announcement-form";
import { AnnouncementStatusButton } from "@/components/announcement-status-button";
import { formatDateTime } from "@/lib/utils";
import { Pin } from "lucide-react";

export const dynamic = "force-dynamic";

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Herkes",
  branch: "Şube",
  teachers: "Öğretmenler",
  parents: "Veliler",
  students: "Öğrenciler",
  studentType: "Öğrenci türü",
  selected: "Seçili kullanıcılar",
};

export default async function DuyurularPage() {
  let ctx;
  try {
    ctx = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/duyurular");
  }
  if (ctx.role !== "SCHOOL_ADMIN" && ctx.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const [result, data] = await Promise.all([listAllAnnouncementsTool(ctx), readData()]);
  const announcements = result.ok ? result.data.announcements : [];

  return (
    <div>
      <PageHeader
        title="Duyuru Merkezi"
        description="Veli, öğretmen veya belirli bir hedef kitleye duyuru oluşturun. Hedef kitle eşleştirmesi sunucu tarafında yapılır — hedef dışı kullanıcı asla duyuruyu görmez."
      />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Yeni duyuru</h2>
        <AnnouncementForm
          branches={data.settings.branches.map((b) => ({ id: b.id, shortName: b.shortName }))}
        />
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-50">Duyurular</h2>
      {announcements.length === 0 ? (
        <EmptyState
          title="Henüz duyuru yok"
          description="Yukarıdaki formdan ilk duyurunuzu oluşturun."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className={a.pinned ? "border-violet-200" : undefined}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned ? <Pin className="h-3.5 w-3.5 text-violet-600" /> : null}
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{a.title}</h3>
                    <Badge status={a.status} />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {AUDIENCE_LABELS[a.audienceType] ?? a.audienceType}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{a.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Oluşturulma: {formatDateTime(a.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {a.status !== "published" ? (
                    <AnnouncementStatusButton
                      announcementId={a.id}
                      targetStatus="published"
                      label="Yayınla"
                    />
                  ) : null}
                  {a.status !== "archived" ? (
                    <AnnouncementStatusButton
                      announcementId={a.id}
                      targetStatus="archived"
                      label="Arşivle"
                    />
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
