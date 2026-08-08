import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { Badge, Card, PageHeader, EmptyState } from "@/components/ui";
import { formatTime } from "@/lib/utils";
import { LessonOpsActions, LessonOpsBadges } from "@/components/lesson-ops-actions";

export const dynamic = "force-dynamic";

/**
 * Yoklama — varsayılan yalnız bugünün dersleri.
 * Üç operasyonel aksiyon: Geldi, İşlendi, Telafi (ayrı bayraklar).
 */
export default async function YoklamaPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/yoklama");
  }
  if (session.role === "TEACHER") redirect("/ogretmen");
  if (session.role === "PARENT") redirect("/veli");
  if (session.role === "STUDENT") redirect("/ogrenci");

  const data = await readData();
  const now = new Date();
  // Yerel gün anahtarı (TR): ISO slice UTC kaymasına karşı formatla
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const todayLessons = data.lessons
    .filter((l) => {
      const d = new Date(l.startAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return key === todayKey;
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <div>
      <PageHeader
        title="Yoklama"
        description="Bugünün dersleri. Geldi = katılım, İşlendi = ders tamamlandı (hakediş), Telafi = telafi akışı. Birlikte işaretlenebilir."
      />

      <Card className="mb-6 !p-4 text-sm text-stone-600">
        Varsayılan görünüm: <strong>yalnız bugün</strong> ({todayKey}). Geçmiş 14 gün listesi kaldırıldı — gürültüyü azaltmak için.
      </Card>

      {todayLessons.length === 0 ? (
        <EmptyState title="Bugün ders yok" description="Programda bugüne ait seans bulunmuyor." />
      ) : (
        <div className="space-y-3">
          {todayLessons.map((lesson) => {
            const student = data.students.find((s) => s.id === lesson.studentId);
            const teacher = data.teachers.find((t) => t.id === lesson.teacherId);
            const room = data.rooms.find((r) => r.id === lesson.roomId);
            return (
              <Card key={lesson.id} className="!p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {formatTime(lesson.startAt)} · {student?.name ?? "—"}
                    </p>
                    <p className="text-sm text-stone-500">
                      {lesson.instrument} · {teacher?.name ?? "—"} · {room?.name ?? "—"}
                      {lesson.type === "makeup" ? " · (tip: makeup)" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge status={lesson.status} />
                      <LessonOpsBadges
                        studentAttended={lesson.studentAttended}
                        lessonProcessed={lesson.lessonProcessed}
                        opsMakeupFlag={lesson.opsMakeupFlag}
                      />
                    </div>
                    {(lesson.studentAttendedBy || lesson.lessonProcessedBy || lesson.opsMakeupFlagBy) && (
                      <p className="mt-1 text-[11px] text-stone-400">
                        {lesson.studentAttendedAt
                          ? `Geldi: ${lesson.studentAttendedBy} @ ${lesson.studentAttendedAt.slice(0, 16)}`
                          : ""}
                        {lesson.lessonProcessedAt
                          ? ` · İşlendi: ${lesson.lessonProcessedBy} @ ${lesson.lessonProcessedAt.slice(0, 16)}`
                          : ""}
                        {lesson.opsMakeupFlagAt
                          ? ` · Telafi: ${lesson.opsMakeupFlagBy} @ ${lesson.opsMakeupFlagAt.slice(0, 16)}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <LessonOpsActions
                    lessonId={lesson.id}
                    studentAttended={lesson.studentAttended}
                    lessonProcessed={lesson.lessonProcessed}
                    opsMakeupFlag={lesson.opsMakeupFlag}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
