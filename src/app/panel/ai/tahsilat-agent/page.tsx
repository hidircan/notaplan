import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CircleDollarSign, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { TahsilatQueue } from "@/components/tahsilat-queue";
import { getCollectionRoi, listFollowUpCases, mergeCollectionRoi } from "@/lib/tahsilat/cases";
import { buildTahsilatQueue } from "@/lib/tahsilat/queue";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { AiInsightTrigger } from "@/components/ai/ai-insight-trigger";
import { CollectionsIntakeScan } from "@/components/collections-intake-scan";

export const dynamic = "force-dynamic";

export default async function TahsilatAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/ai/tahsilat-agent");
  }

  const { studentId: studentFilter } = await searchParams;
  const kurum = await getInstitutionContext(session);
  const tenantIds = kurum.scope.mode === "all" ? kurum.scope.tenantIds : [kurum.scope.tenantId];
  const data = await readScopedData(kurum.scope);
  const roi = mergeCollectionRoi(await Promise.all(tenantIds.map((tid) => getCollectionRoi(tid))));
  const followUpCases = (await Promise.all(tenantIds.map((tid) => listFollowUpCases(tid)))).flat();
  const filteredStudent = studentFilter
    ? data.students.find((s) => s.id === studentFilter)
    : undefined;

  const rows = buildTahsilatQueue(data, followUpCases, new Date(), studentFilter);
  const overdueCount = rows.filter((r) => r.paymentStatus === "overdue").length;
  const trackedOutstanding = rows.reduce((sum, r) => sum + r.remaining, 0);
  const successRateLabel = roi.successRate === null ? "—" : `%${Math.round(roi.successRate * 100)}`;

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <PageHeader
        title="Tahsilat"
        description="Riskteki ödemeleri önceliklendirir, veliye gönderilecek mesaj taslağını hazırlar; hiçbir mesaj insan onayı olmadan gönderilmez."
        actions={
          <Link href="/panel/odemeler" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-700">
            Ödemeleri yönet <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {studentFilter ? (
        <Card className="mb-6 border-violet-200 bg-violet-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-violet-900">
              {filteredStudent
                ? `${filteredStudent.name} için filtrelendi.`
                : "Bu öğrenci için kayıt bulunamadı — filtre boş sonuç veriyor."}
            </p>
            <Link
              href="/panel/ai/tahsilat-agent"
              className="text-sm font-medium text-violet-700 hover:text-violet-900"
            >
              Tümünü göster ×
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Takip edilen alacak"
          value={formatMoney(trackedOutstanding)}
          hint={`${rows.length} açık kayıt`}
          accent="primary"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Gecikmiş ödeme"
          value={overdueCount}
          hint="Öncelikli takip"
          accent="danger"
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Bu ay tahsil edilen"
          value={formatMoney(roi.attributedThisMonth)}
          hint={`${roi.resolvedThisMonth} vaka kapandı`}
          accent="success"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Başarı oranı"
          value={successRateLabel}
          hint={
            roi.closedThisMonth === 0
              ? "Bu ay henüz kapanan vaka yok"
              : `${roi.resolvedThisMonth} ödendi · ${roi.lostThisMonth} sonuçsuz`
          }
          accent="info"
          icon={<Target className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <p className="text-sm font-medium text-emerald-900">Onay kuralı</p>
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            Hiçbir mesaj insan onayı olmadan gönderilmez. Taslağı düzenleyip onayladıktan sonra
            WhatsApp&apos;ta siz açarsınız.
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">Vaka aşamaları</p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
            {(["draft", "approved", "sent", "replied"] as const).map((st) => (
              <span key={st} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    st === "draft"
                      ? "bg-slate-400"
                      : st === "approved"
                        ? "bg-sky-500"
                        : st === "sent"
                          ? "bg-indigo-500"
                          : "bg-violet-500"
                  }`}
                />
                {followUpCases.filter((c) => c.status === st).length} ·{" "}
                {st === "draft" ? "Taslak" : st === "approved" ? "Onaylı" : st === "sent" ? "Gönderildi" : "Yanıt geldi"}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {followUpCases.filter((c) => c.status === "paid").length} · Ödendi
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              {followUpCases.filter((c) => c.status === "lost").length} · Sonuçsuz
            </span>
          </div>
        </Card>
      </div>

      {session.role === "SUPER_ADMIN" || session.role === "SCHOOL_ADMIN" ? (
        <Card className="mt-6 border-violet-200 bg-violet-50/30">
          <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            İşletme sahibi analizi
          </p>
          <AiInsightTrigger
            capabilityId="collectionsROIReport"
            label="AI analiz üret"
            payload={{
              trackedOutstanding,
              overdueCount,
              attributedThisMonth: roi.attributedThisMonth,
              resolvedThisMonth: roi.resolvedThisMonth,
              lostThisMonth: roi.lostThisMonth,
              successRate: roi.successRate,
            }}
          />
        </Card>
      ) : null}

      {(session.role === "SUPER_ADMIN" || session.role === "SCHOOL_ADMIN") && kurum.scope.mode === "single" ? (
        (() => {
          const untracked = rows.filter((r) => r.caseStatus === "draft");
          if (untracked.length === 0) return null;
          return (
            <Card className="mt-6">
              <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                Takibi başlamamış {untracked.length} kayıt — hangisi öncelikli?
              </p>
              <CollectionsIntakeScan
                tenantId={kurum.scope.tenantId}
                payload={{
                  untrackedCount: untracked.length,
                  totalUntrackedAmount: untracked.reduce((sum, r) => sum + r.remaining, 0),
                  topCases: untracked.slice(0, 5).map((r) => ({
                    studentName: r.studentName,
                    remaining: r.remaining,
                    daysOverdue: r.daysOverdue,
                  })),
                }}
              />
            </Card>
          );
        })()
      ) : null}

      <Card className="mt-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">Bugünün takip kuyruğu</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gecikmesi ve tutarı en yüksek kayıtlar önce gelir. Her kayıt için sonraki adım açıkça belirtilir.
            </p>
          </div>
        </div>
        <TahsilatQueue
          rows={rows}
          canWrite={kurum.scope.mode === "single"}
          tenantId={kurum.scope.mode === "single" ? kurum.scope.tenantId : ""}
          canUseAiDraft={session.role === "SUPER_ADMIN" || session.role === "SCHOOL_ADMIN"}
        />
      </Card>
    </div>
  );
}
