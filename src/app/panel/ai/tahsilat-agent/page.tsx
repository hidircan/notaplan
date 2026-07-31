import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Bot, CircleDollarSign, MessageCircle, ShieldCheck } from "lucide-react";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import { readData } from "@/lib/store";
import { formatMoney } from "@/lib/utils";
import { TahsilatMessageApproval } from "@/components/tahsilat-message-approval";
import { getCollectionRoi, listFollowUpCases } from "@/lib/tahsilat/cases";
import { requireSessionContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  overdue: "Gecikmiş",
  partial: "Kısmi ödeme",
};

export default async function TahsilatAgentPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/ai/tahsilat-agent");
  }

  const data = await readData();
  const roi = await getCollectionRoi(session.tenantId);
  const followUpCases = await listFollowUpCases(session.tenantId);
  const cases = data.payments
    .filter((payment) => payment.status === "overdue" || payment.status === "partial")
    .map((payment) => ({
      payment,
      student: data.students.find((student) => student.id === payment.studentId),
    }))
    .sort((a, b) => Number(b.payment.amount) - Number(a.payment.amount));

  const overdue = cases.filter(({ payment }) => payment.status === "overdue");
  const outstanding = cases.reduce((sum, { payment }) => sum + Number(payment.amount), 0);

  return (
    <div>
      <PageHeader
        title="AI Tahsilat Agent"
        description="Geciken ödemeleri önceliklendirir, veli iletişimini hazırlar ve tahsilat ekibinin günlük takibini tek ekranda toplar."
        actions={
          <Link href="/panel/odemeler" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-700">
            Ödemeleri yönet <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aksiyon bekleyen veli" value={cases.length} hint="Agent takip kuyruğu" accent="amber" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Gecikmiş ödeme" value={overdue.length} hint="Öncelikli takip" accent="rose" icon={<CircleDollarSign className="h-5 w-5" />} />
        <StatCard label="Riskteki tutar" value={formatMoney(outstanding)} hint="Gecikmiş + kısmi ödeme" accent="violet" icon={<Bot className="h-5 w-5" />} />
        <StatCard label="Agent kuralı" value="Onaylı" hint="Mesaj gönderimi insan onaylı" accent="emerald" icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm text-emerald-800">Bu ay agent katkılı tahsilat</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{formatMoney(roi.attributedThisMonth)}</p>
          <p className="text-xs text-emerald-700">{roi.resolvedThisMonth} vaka kapatıldı · {roi.activeCases} aktif takip</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
          <p className="text-sm font-medium text-slate-800">Durum dağılımı</p>
          <p className="mt-1 text-sm text-slate-500">
            {["draft","approved","sent","replied","paid","lost"].map((st) => `${st}: ${followUpCases.filter((c) => c.status === st).length}`).join(" · ")}
          </p>
          <p className="mt-2 text-xs text-slate-400">Vaka kayıtları tenant bazlı tutulur; production&apos;da PaymentFollowUpCase tablosuna geçer.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Bugünün takip kuyruğu</h2>
              <p className="mt-1 text-sm text-slate-500">Tutarı yüksek ve gecikmiş kayıtlar önce gelir. Mesajlar gönderilmeden önce ekip onayı gerekir.</p>
            </div>
            <Badge status={overdue.length ? "overdue" : "paid"} />
          </div>
          {cases.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-6 text-sm text-emerald-800">Takip gerektiren açık ödeme yok. Agent kuyruğu temiz.</p>
          ) : (
            <div className="space-y-3">
              {cases.map(({ payment, student }) => {
                const overdueCase = payment.status === "overdue";
                const suggestedMessage = `Merhaba, ${student?.name ?? "öğrencimiz"} için ${formatMoney(Number(payment.amount))} tutarında ${overdueCase ? "gecikmiş" : "kısmi"} ödeme kaydı bulunmaktadır. Size uygun ödeme planı için bizimle iletişime geçebilirsiniz.`;
                return (
                  <div key={payment.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{student?.name ?? "Öğrenci bulunamadı"}</p>
                        <p className="mt-1 text-sm text-slate-500">{statusLabel[payment.status] ?? payment.status} · Tahsilat önceliği: {overdueCase ? "Yüksek" : "Orta"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatMoney(Number(payment.amount))}</p>
                        <Badge status={payment.status} />
                      </div>
                    </div>
                    {student ? (
                      <TahsilatMessageApproval
                        caseId={followUpCases.find((c) => c.paymentId === payment.id && c.status !== "paid" && c.status !== "lost")?.id}
                        paymentId={payment.id}
                        studentId={payment.studentId}
                        amount={Number(payment.amount)}
                        initialStatus={(followUpCases.find((c) => c.paymentId === payment.id && c.status !== "paid" && c.status !== "lost")?.status as "draft") ?? "draft"}
                        studentName={student.name}
                        parentName={student.parentName}
                        parentPhone={student.parentPhone}
                        initialMessage={suggestedMessage}
                      />
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/panel/odemeler" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"><CircleDollarSign className="h-4 w-4" /> Ödemeyi görüntüle</Link>
                      <Link href="/panel/chat" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><MessageCircle className="h-4 w-4" /> AI Asistan ile zenginleştir</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">Satılabilir agent akışı</h2>
          <ol className="mt-4 space-y-4 text-sm text-slate-600">
            <li><span className="mr-2 font-semibold text-violet-600">1.</span>Geciken ödemeleri otomatik kuyruğa alır.</li>
            <li><span className="mr-2 font-semibold text-violet-600">2.</span>Veliye özel, düzenlenebilir iletişim taslağı üretir.</li>
            <li><span className="mr-2 font-semibold text-violet-600">3.</span>İnsan onayı sonrası mevcut mesaj kanalından gönderilir.</li>
            <li><span className="mr-2 font-semibold text-violet-600">4.</span>Ödeme sonucu ve iletişim geçmişi gelecekteki önceliklendirmeyi besler.</li>
          </ol>
          <div className="mt-5 rounded-xl bg-violet-50 p-4 text-sm text-violet-900"><strong>Paketleme fikri:</strong> &quot;AI Tahsilat Asistanı&quot;nı kurum başına aylık abonelik + gönderilen mesaj/agent işlem kotasıyla fiyatlandır.</div>
        </Card>
      </div>
    </div>
  );
}
