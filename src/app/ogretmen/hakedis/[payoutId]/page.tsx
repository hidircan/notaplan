import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readData } from "@/lib/store";
import { requireSessionContext } from "@/lib/auth/session";
import { findOwnPayout } from "@/lib/teacher-portal-scope";
import { computeTeacherEarningsForPeriod } from "@/lib/teacher-payout";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Öğretmenin kendi hakediş detayı. `payoutId` URL'den geliyor ama teacherId
 * ASLA URL'den alınmaz — yalnızca oturumdan gelir. `findOwnPayout` kaydın
 * gerçekten bu öğretmene ait olduğunu doğrular; değilse (başka öğretmenin
 * payoutId'si denenirse) "bulunamadı" gösterilir, hiçbir veri sızmaz.
 */
export default async function TeacherOwnPayoutDetailPage({
  params,
}: {
  params: Promise<{ payoutId: string }>;
}) {
  const { payoutId } = await params;

  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/ogretmen/hakedis/${payoutId}`);
  }
  if (session.role === "PARENT") redirect("/veli");

  const data = await readData();
  const teacherId = session.teacherId || "t2";
  const teacher = data.teachers.find((t) => t.id === teacherId) ?? data.teachers[0];
  if (!teacher) redirect("/login");

  const payout = findOwnPayout(data.teacherPayouts, payoutId, teacher.id);

  if (!payout) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-slate-50">
        <header className="border-b border-cyan-100 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
            <Link href="/ogretmen/hakedis" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
              <ArrowLeft className="h-4 w-4" /> Geri
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-10">
          <EmptyState
            title="Hakediş kaydı bulunamadı"
            description="Bu kayıt size ait değil, silinmiş olabilir veya artık mevcut değil."
          />
        </main>
      </div>
    );
  }

  const earnings = computeTeacherEarningsForPeriod(data, teacher.id, payout.periodStart, payout.periodEnd);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-slate-50">
      <header className="border-b border-cyan-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Link href="/ogretmen/hakedis" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" /> Geri
          </Link>
          <Badge status={payout.status} />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
        <Card className="border-cyan-100">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{payout.totalMinutes}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Dakika</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-emerald-700">{formatMoney(payout.totalAmount)}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Tutar</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {payout.status === "paid" ? "Ödendi" : "Bekliyor"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Durum</p>
            </div>
          </div>
          {payout.status === "paid" && payout.paidAt ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Ödeme tarihi: {formatDate(payout.paidAt)}
              {payout.method ? ` · Yöntem: ${payout.method}` : ""}
            </p>
          ) : null}
        </Card>

        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Ders dökümü</h2>
          {earnings.lines.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500 dark:text-slate-400">Bu döneme ait ders kaydı bulunamadı.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {earnings.lines.map((line) => (
                <Card key={line.lessonId} className="!p-3">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(line.lessonDate)} · {line.studentName ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {line.branchName ?? "—"} · {line.instrument} · {line.durationMinutes} dk
                      </p>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-50">{formatMoney(line.amount)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
