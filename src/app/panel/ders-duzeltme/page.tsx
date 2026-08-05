import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { Card, PageHeader } from "@/components/ui";
import { LessonTimeCorrectionForm } from "@/components/lesson-time-correction-form";
import { formatDateTime } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ders zamanı düzeltme"
        description="Yalnızca yöneticiler. Düzeltme notu zorunludur; audit kaydı yazılır."
      />
      <Card>
        <LessonTimeCorrectionForm lessons={lessons} />
      </Card>
    </div>
  );
}
