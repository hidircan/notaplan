import Link from "next/link";
import { ArrowLeft, ArrowRight, Receipt } from "lucide-react";
import { readData } from "@/lib/store";
import { actionAddPayment } from "@/lib/actions";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, StatCard } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { computeStudentPaymentSummary, sortPaymentsForProfile } from "@/lib/payment-profile";

export const dynamic = "force-dynamic";

export default async function StudentPaymentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const data = await readData();
  const student = data.students.find((s) => s.id === studentId);

  if (!student) {
    return (
      <div>
        <PageHeader title="Ödeme profili" description="Öğrenci bulunamadı." />
        <EmptyState
          title="Öğrenci bulunamadı"
          description="Bu öğrenci mevcut okulunuza kayıtlı değil veya kaldırılmış olabilir."
        />
        <Link
          href="/panel/odemeler"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          <ArrowLeft className="h-4 w-4" /> Ödemelere dön
        </Link>
      </div>
    );
  }

  const payments = sortPaymentsForProfile(data.payments.filter((p) => p.studentId === studentId));
  const summary = computeStudentPaymentSummary(payments);
  const hasOpenPayment = summary.openCount > 0;

  return (
    <div>
      <PageHeader
        title={student.name}
        description={
          student.parentPhone
            ? `Veli: ${student.parentName} · ${student.parentPhone}`
            : `Veli: ${student.parentName}`
        }
        actions={
          <Link
            href="/panel/odemeler"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Tüm ödemeler
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Toplam tahakkuk" value={formatMoney(summary.totalBilled)} accent="violet" />
        <StatCard label="Toplam tahsil edilen" value={formatMoney(summary.totalCollected)} accent="emerald" />
        <StatCard label="Kalan borç" value={formatMoney(summary.remaining)} accent="amber" />
        <StatCard label="Gecikmiş kalan" value={formatMoney(summary.overdueRemaining)} accent="rose" />
        <StatCard label="Açık ödeme kaydı" value={summary.openCount} accent="sky" />
      </div>

      {hasOpenPayment ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-900">
              Bu öğrencinin açık veya gecikmiş ödemesi var. Tahsilat Operasyon Merkezi&apos;nde
              iletişim taslağını hazırlayıp onaylayabilirsiniz.
            </p>
            <Link
              href={`/panel/ai/tahsilat-agent?studentId=${student.id}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Tahsilat takibini aç <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      ) : null}

      <details className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Yeni ödeme kaydı ekle
        </summary>
        <form action={actionAddPayment} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="studentId" value={student.id} />
          <div>
            <Label>Açıklama / dönem</Label>
            <Input name="description" required placeholder="Örn. Ağustos 2026 — Piyano" />
          </div>
          <div>
            <Label>Tutar (₺)</Label>
            <Input name="amount" type="number" min={1} defaultValue={student.monthlyFee} required />
          </div>
          <div>
            <Label>Vade tarihi</Label>
            <Input name="dueDate" type="date" required />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit">Ödeme kaydı ekle</Button>
          </div>
        </form>
      </details>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Ödeme geçmişi</h2>
      {payments.length === 0 ? (
        <EmptyState
          title="Ödeme kaydı yok"
          description="Bu öğrenci için henüz bir ödeme kaydı oluşturulmadı."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Dönem / açıklama</th>
                <th className="px-4 py-3">Vade</th>
                <th className="px-4 py-3">Toplam</th>
                <th className="px-4 py-3">Ödenen</th>
                <th className="px-4 py-3">Kalan</th>
                <th className="px-4 py-3">Yöntem</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Makbuz</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.description}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-3">{formatMoney(p.amount)}</td>
                  <td className="px-4 py-3">{formatMoney(p.paidAmount)}</td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(Math.max(p.amount - p.paidAmount, 0))}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.method ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    {p.status === "paid" ? (
                      <Link
                        href={`/makbuz/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <Receipt className="h-3.5 w-3.5" /> Görüntüle
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
