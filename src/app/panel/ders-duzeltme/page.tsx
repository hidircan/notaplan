import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { Card, PageHeader } from "@/components/ui";
import { LessonTimeCorrectionForm } from "@/components/lesson-time-correction-form";
import { formatDateTime, formatTime } from "@/lib/utils";
import { computeLessonDurationRow } from "@/lib/lesson-duration-report";

export const dynamic = "force-dynamic";

/**
 * EPIC 8 — admin ders zamanı düzeltme UI.
 * API/tool/RBAC zaten var (correctLessonTimesTool); bu sayfa formu bağlar.
 */
export default async function AdminLessonCorrectionPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/ders-duzeltme");
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const data = await readData();
  const lessons = data.lessons
    .filter((l) => l.status === "completed" || l.status === "in_progress" || l.actualStartAt)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 40)
    .map((l) => {
      const student = data.students.find((s) => s.id === l.studentId);
      const teacher = data.teachers.find((t) => t.id === l.teacherId);
      return {
        id: l.id,
        label: `${formatDateTime(l.startAt)} · ${student?.name ?? "—"} · ${teacher?.name ?? "—"} (${l.status})`,
      };
    });

  const durationRows = data.lessons
    .filter((l) => l.status === "completed" || l.status === "in_progress")
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 40)
    .map((l) => {
      const student = data.students.find((s) => s.id === l.studentId);
      const teacher = data.teachers.find((t) => t.id === l.teacherId);
      return { ...computeLessonDurationRow(l), studentName: student?.name ?? "—", teacherName: teacher?.name ?? "—" };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ders zamanı düzeltme"
        description="Yalnızca yöneticiler. Düzeltme notu zorunludur; audit kaydı yazılır."
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Öğrenci</th>
              <th className="px-4 py-3">Öğretmen</th>
              <th className="px-4 py-3">Planlanan</th>
              <th className="px-4 py-3">Başlangıç</th>
              <th className="px-4 py-3">Bitiş</th>
              <th className="px-4 py-3">Gerçekleşen</th>
              <th className="px-4 py-3">Fark</th>
            </tr>
          </thead>
          <tbody>
            {durationRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Henüz başlatılmış/tamamlanmış ders yok.
                </td>
              </tr>
            ) : (
              durationRows.map((r) => (
                <tr key={r.lessonId} className="border-b border-[var(--color-border)]">
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">{r.studentName}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.teacherName}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.plannedMinutes} dk</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {r.actualStartAt ? formatTime(r.actualStartAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {r.actualEndAt ? formatTime(r.actualEndAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {r.actualMinutes !== undefined ? `${r.actualMinutes} dk` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.diffMinutes !== undefined ? (
                      <span
                        className={
                          r.diffMinutes === 0
                            ? "text-[var(--color-text-muted)]"
                            : r.diffMinutes > 0
                              ? "font-medium text-amber-700"
                              : "font-medium text-rose-700"
                        }
                      >
                        {r.diffMinutes > 0 ? `+${r.diffMinutes}` : r.diffMinutes} dk
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <LessonTimeCorrectionForm lessons={lessons} />
      </Card>
    </div>
  );
}
