import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionContext, homePathForRole } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { getAssessmentReportTool } from "@/lib/services";
import { computeOverallScore } from "@/lib/assessment/score";
import { formatDate } from "@/lib/utils";
import { AssessmentActions } from "@/components/assessment-actions";

export const dynamic = "force-dynamic";

export default async function AssessmentReportPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/degerlendirme/rapor/${studentId}`);
  }

  const backHref = homePathForRole(session.role);
  const result = await getAssessmentReportTool(session, { studentId });
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-lg font-semibold text-[var(--color-text)]">Rapor oluşturulamadı.</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Bu öğrenciye erişim yetkiniz olmayabilir.</p>
        <Link href={backHref} className="mt-6 inline-block text-sm font-medium text-amber-600 hover:text-amber-700">
          Geri dön
        </Link>
      </div>
    );
  }

  const data = await readData();
  const student = data.students.find((s) => s.id === studentId);
  const { assessments, trend } = result.data;

  return (
    <div className="min-h-screen bg-[#f4f2f8] px-4 py-8 print:bg-[var(--color-surface)] print:p-0 sm:px-6">
      <style>{"@media print { @page { size: A4; margin: 14mm; } }"}</style>
      <div className="mx-auto max-w-2xl">
        <AssessmentActions backHref={backHref} />

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10">
          <p className="text-lg font-semibold text-[var(--color-text)]">Gelişim Raporu</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{student?.name ?? "—"}</p>

          {trend.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-text-muted)]">Henüz değerlendirme kaydı yok.</p>
          ) : (
            <>
              <div className="mt-6 border-t border-[var(--color-border)] pt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  Genel puan trendi (son {trend.length} değerlendirme)
                </p>
                <div className="mt-3 flex items-end gap-3">
                  {trend.map((point) => (
                    <div key={point.assessmentId} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-amber-500"
                        style={{ height: `${Math.max(point.overallScore, 0.2) * 24}px` }}
                      />
                      <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                        {point.overallScore.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{formatDate(point.date, "d MMM")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-6">
                {assessments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-[var(--color-border)] p-3 print:break-inside-avoid">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {formatDate(a.createdAt, "d MMMM yyyy")}
                      </p>
                      <p className="text-sm font-semibold text-amber-700">
                        {computeOverallScore(a).toFixed(1)} / 5
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{a.strengthNote}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mt-10 text-center text-[11px] text-[var(--color-text-muted)]">
            Bu rapor sistem tarafından oluşturulmuştur.
          </p>
        </div>
      </div>
    </div>
  );
}
