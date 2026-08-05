import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readData } from "@/lib/store";
import { requireSessionContext } from "@/lib/auth/session";
import { Card } from "@/components/ui";
import { TeacherFeedbackForm } from "@/components/teacher-feedback-form";

export const dynamic = "force-dynamic";

/**
 * EPIC 6C (IMPLEMENTATION_PLAN.md) — velinin öğretmen hakkında yapılandırılmış
 * geri bildirim gönderdiği form. Kamuya açık ortalama/sıralama YOK; yalnızca
 * SCHOOL_ADMIN/SUPER_ADMIN görür (bkz. src/lib/teacher-feedback.ts).
 */
export default async function ParentTeacherFeedbackPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/veli/degerlendirme");
  }
  if (session.role === "TEACHER") redirect("/ogretmen");

  const data = await readData();
  const studentId = session.studentId || "s1";
  const student = data.students.find((s) => s.id === studentId) ?? data.students[0];
  if (!student) redirect("/login");
  const teacher = data.teachers.find((t) => t.id === student.teacherId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-slate-50">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Link href="/veli" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" /> Geri
          </Link>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Öğretmen değerlendirmesi</p>
          <span className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
            {teacher?.name ?? "Öğretmen"} hakkında
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Bu geri bildirim yalnızca okul yönetimi tarafından görüntülenir; öğretmenin kendisine
            veya başka bir veliye gösterilmez.
          </p>
        </Card>

        <Card>
          <TeacherFeedbackForm studentId={student.id} />
        </Card>
      </main>
    </div>
  );
}
