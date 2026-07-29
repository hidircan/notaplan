import { actionMarkAttendance } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { formatDateTime, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function YoklamaPage() {
  const data = await readData();

  // Son 14 gün + bugün + yarın dersleri
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const lessons = [...data.lessons]
    .filter((l) => new Date(l.startAt).getTime() >= cutoff)
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

  return (
    <div>
      <PageHeader
        title="Yoklama"
        description="Dersi işaretleyin. Devamsızlık veya okul iptali otomatik telafi hakkı oluşturur."
      />

      <div className="space-y-3">
        {lessons.map((lesson) => {
          const student = data.students.find((s) => s.id === lesson.studentId);
          const teacher = data.teachers.find((t) => t.id === lesson.teacherId);
          const attendance = data.attendances.find((a) => a.lessonId === lesson.id);
          const isPast = new Date(lesson.startAt).getTime() < Date.now();

          return (
            <Card key={lesson.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      {student?.name} · {lesson.instrument}
                    </p>
                    <Badge status={lesson.status} />
                    {lesson.type === "makeup" ? <Badge status="makeup" /> : null}
                    {attendance ? <Badge status={attendance.status} /> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTime(lesson.startAt)} ({formatTime(lesson.startAt)}–
                    {formatTime(lesson.endAt)}) · {teacher?.name}
                  </p>
                  {attendance?.reason ? (
                    <p className="mt-1 text-xs text-slate-400">Not: {attendance.reason}</p>
                  ) : null}
                </div>

                {(isPast || lesson.status === "scheduled") && !attendance ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={actionMarkAttendance}>
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <input type="hidden" name="status" value="present" />
                      <Button type="submit" variant="success">
                        Geldi
                      </Button>
                    </form>
                    <form action={actionMarkAttendance}>
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <input type="hidden" name="status" value="absent" />
                      <input type="hidden" name="reason" value="Veli bildirdi — mazeret" />
                      <Button type="submit" variant="danger">
                        Gelmedi (+telafi)
                      </Button>
                    </form>
                    <form action={actionMarkAttendance}>
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <input type="hidden" name="status" value="cancelled_by_school" />
                      <input type="hidden" name="reason" value="Okul / öğretmen kaynaklı iptal" />
                      <Button type="submit" variant="secondary">
                        Okul iptal (+telafi)
                      </Button>
                    </form>
                  </div>
                ) : attendance ? (
                  <p className="text-sm text-slate-500">
                    Yoklama alındı
                    {attendance.createsMakeupCredit ? " · telafi hakkı oluşturuldu" : ""}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">Henüz yoklama zamanı değil</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
