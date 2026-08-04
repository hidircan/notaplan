import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionContext, homePathForRole } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { getAssessmentTool } from "@/lib/services";
import { ASSESSMENT_SECTIONS, ASSESSMENT_ITEM_LABELS, computeOverallScore } from "@/lib/assessment/score";
import { formatDate } from "@/lib/utils";
import { AssessmentActions } from "@/components/assessment-actions";

export const dynamic = "force-dynamic";

function NoticeScreen({ title, description, backHref }: { title: string; description: string; backHref: string }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <Link href={backHref} className="mt-6 inline-block text-sm font-medium text-violet-600 hover:text-violet-700">
        Geri dön
      </Link>
    </div>
  );
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/degerlendirme/${assessmentId}`);
  }

  const backHref = homePathForRole(session.role);
  const result = await getAssessmentTool(session, { assessmentId });
  if (!result.ok) {
    return (
      <NoticeScreen
        title="Değerlendirme bulunamadı."
        description="Bu kayıt silinmiş olabilir veya erişim yetkiniz yok."
        backHref={backHref}
      />
    );
  }
  const assessment = result.data.assessment;

  const data = await readData();
  const student = data.students.find((s) => s.id === assessment.studentId);
  const teacher = data.teachers.find((t) => t.id === assessment.teacherId);
  const overall = computeOverallScore(assessment);

  return (
    <div className="min-h-screen bg-[#f4f2f8] px-4 py-8 print:bg-white print:p-0 sm:px-6">
      <style>{"@media print { @page { size: A4; margin: 14mm; } }"}</style>
      <div className="mx-auto max-w-2xl">
        <AssessmentActions backHref={backHref} />

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
            <p className="text-lg font-semibold text-slate-900">Öğrenci Gelişim Değerlendirmesi</p>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Genel puan</p>
              <p className="mt-1 text-2xl font-bold text-violet-700">{overall.toFixed(1)} / 5</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Öğrenci</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{student?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Öğretmen</p>
              <p className="mt-1 text-slate-800">{teacher?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tarih</p>
              <p className="mt-1 text-slate-800">{formatDate(assessment.createdAt, "d MMMM yyyy")}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            {ASSESSMENT_SECTIONS.map((section) => (
              <div key={section.id} className="print:break-inside-avoid">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {section.id}. {section.label}
                </p>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <div key={item} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{ASSESSMENT_ITEM_LABELS[item]}</span>
                      <span className="font-semibold text-slate-900">{assessment[item]} / 5</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-4 border-t border-slate-100 pt-6 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Güçlü yönler</p>
              <p className="mt-1 text-slate-800">{assessment.strengthNote}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Gelişime açık alanlar</p>
              <p className="mt-1 text-slate-800">{assessment.improvementNote}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sonraki adımlar</p>
              <p className="mt-1 text-slate-800">{assessment.nextStepsNote}</p>
            </div>
            {assessment.parentPrivateNote ? (
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Veliye özel not
                </p>
                <p className="mt-1 text-amber-900">{assessment.parentPrivateNote}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-12 flex border-t border-slate-100 pt-10 print:break-inside-avoid">
            <div className="min-w-[220px] max-w-xs flex-1">
              <p className="text-sm text-slate-800">{assessment.teacherSignedName}</p>
              <div className="mt-1 h-16 border-b border-slate-400" />
              <p className="mt-2 text-center text-xs font-medium text-slate-600">
                Öğretmen İmzası · {formatDate(assessment.teacherSignedAt, "d MMMM yyyy")}
              </p>
            </div>
          </div>

          <p className="mt-10 text-center text-[11px] text-slate-400">
            Bu değerlendirme sistem tarafından oluşturulmuştur.
          </p>
        </div>
      </div>
    </div>
  );
}
