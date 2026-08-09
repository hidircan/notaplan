import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readData } from "@/lib/store";
import { requireSessionContext } from "@/lib/auth/session";
import { listHomeworkForStudentTool, listHomeworkSubmissionsTool } from "@/lib/services";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * EPIC 6C (IMPLEMENTATION_PLAN.md) — velinin kendi çocuğunun ödevlerini
 * ve öğretmen geri bildirimini SALT OKUNUR görebildiği ekran. Yükleme
 * yalnızca öğrencinin kendisine ait (bkz. EPIC 6B) — veli için bir yükleme
 * yolu bilerek YOK.
 */
export default async function ParentHomeworkPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/veli/odevler");
  }
  if (session.role === "TEACHER") redirect("/ogretmen");

  const data = await readData();
  const studentId = session.studentId || "s1";
  const student = data.students.find((s) => s.id === studentId) ?? data.students[0];
  if (!student) redirect("/login");

  const homeworkResult = await listHomeworkForStudentTool(session, { studentId: student.id });
  const homework = homeworkResult.ok ? homeworkResult.data.homework : [];

  const withSubmissions = await Promise.all(
    homework.map(async (hw) => {
      const result = await listHomeworkSubmissionsTool(session, { homeworkId: hw.id });
      return { homework: hw, submissions: result.ok ? result.data.submissions : [] };
    })
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-slate-50">
      <header className="border-b border-amber-100 bg-[var(--color-surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Link href="/veli" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
            <ArrowLeft className="h-4 w-4" /> Geri
          </Link>
          <p className="text-sm font-semibold text-[var(--color-text)] dark:text-slate-50">{student.name} — Ödevler</p>
          <span className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-3 px-4 py-6 pb-24">
        {withSubmissions.length === 0 ? (
          <EmptyState title="Henüz ödev yok" />
        ) : (
          withSubmissions.map(({ homework: hw, submissions }) => (
            <Card key={hw.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--color-text)] dark:text-slate-50">{hw.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{hw.description}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Son teslim: {formatDate(hw.dueDate)}</p>
                </div>
                <Badge status={submissions.length > 0 ? "completed" : "pending"}>
                  {submissions.length > 0 ? "Teslim edildi" : "Bekliyor"}
                </Badge>
              </div>
              {submissions.map((s) => (
                <div key={s.id} className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Teslim: {formatDateTime(s.submittedAt)}</p>
                  {s.teacherFeedback ? (
                    <p className="mt-1 rounded-md bg-amber-50 p-1.5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      Öğretmen geri bildirimi: {s.teacherFeedback}
                    </p>
                  ) : null}
                </div>
              ))}
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
