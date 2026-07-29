import Link from "next/link";
import { readData } from "@/lib/store";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime, formatTime } from "@/lib/utils";
import { actionMarkAttendance } from "@/lib/actions";
import { CalendarDays, Home, Music2, Users } from "lucide-react";

export const dynamic = "force-dynamic";

/** Demo öğretmen portalı — örnek: Can Yılmaz (Gitar / Erzene) */
export default async function OgretmenPortalPage() {
  const data = await readData();
  const teacher = data.teachers.find((t) => t.id === "t2") ?? data.teachers[0];
  const branch = data.settings.branches.find((b) => b.id === teacher.branchId);
  const students = data.students.filter((s) => s.teacherId === teacher.id && s.active);

  const today = new Date().toISOString().slice(0, 10);
  const todayLessons = data.lessons
    .filter((l) => l.teacherId === teacher.id && l.startAt.startsWith(today))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const weekLessons = data.lessons
    .filter((l) => l.teacherId === teacher.id && l.status === "scheduled")
    .filter((l) => new Date(l.startAt) >= new Date())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-slate-50">
      <header className="border-b border-cyan-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: teacher.color }}
            >
              {teacher.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{teacher.name}</p>
              <p className="text-[11px] text-slate-500">
                Öğretmen · {branch?.shortName} · {teacher.instruments.join(", ")}
              </p>
            </div>
          </div>
          <Link href="/" className="text-slate-400">
            <Home className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
        <Card className="border-cyan-100">
          <div className="flex items-center gap-2 text-cyan-700">
            <Music2 className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">{data.settings.name}</p>
          </div>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Bugünkü programın</h1>
          <p className="text-sm text-slate-500">
            {todayLessons.length} ders · {students.length} aktif öğrenci
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Demo öğretmen portalı, bugünkü derslerini ve yoklama kontrolünü hızlıca gösterir.
          </p>
        </Card>

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold text-slate-800">Bugün</h2>
          </div>
          {todayLessons.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">Bugün dersin yok.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {todayLessons.map((lesson) => {
                const student = data.students.find((s) => s.id === lesson.studentId);
                const attendance = data.attendances.find((a) => a.lessonId === lesson.id);
                const room = data.rooms.find((r) => r.id === lesson.roomId);
                return (
                  <Card key={lesson.id} className="!p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {formatTime(lesson.startAt)} · {student?.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {lesson.instrument} · {room?.name}
                          {lesson.type === "makeup" ? " · Telafi" : ""}
                        </p>
                      </div>
                      <Badge status={attendance?.status ?? lesson.status} />
                    </div>
                    {!attendance && lesson.status === "scheduled" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={actionMarkAttendance}>
                          <input type="hidden" name="lessonId" value={lesson.id} />
                          <input type="hidden" name="status" value="present" />
                          <Button type="submit" variant="success" className="!py-1.5 text-xs">
                            Geldi
                          </Button>
                        </form>
                        <form action={actionMarkAttendance}>
                          <input type="hidden" name="lessonId" value={lesson.id} />
                          <input type="hidden" name="status" value="absent" />
                          <input type="hidden" name="reason" value="Öğretmen kaydı — gelmedi" />
                          <Button type="submit" variant="danger" className="!py-1.5 text-xs">
                            Gelmedi
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Users className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-800">Öğrencilerim</h2>
          </div>
          <div className="space-y-2">
            {students.map((s) => (
              <Card key={s.id} className="!p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.instruments.join(", ")} · Veli: {s.parentName}
                    </p>
                  </div>
                  <Badge>{s.packageName.split("—")[0]?.trim()}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-slate-800">Yaklaşan seanslar</h2>
          <div className="space-y-2">
            {weekLessons.map((l) => {
              const student = data.students.find((s) => s.id === l.studentId);
              return (
                <Card key={l.id} className="!p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{formatDateTime(l.startAt)}</p>
                      <p className="text-xs text-slate-500">
                        {student?.name} · {l.instrument}
                      </p>
                    </div>
                    {l.type === "makeup" ? <Badge status="makeup" /> : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <p className="px-1 text-center text-[11px] text-slate-400">
          Demo ·{" "}
          <Link href="/panel" className="text-cyan-700">
            Yönetim paneli
          </Link>
        </p>
      </main>
    </div>
  );
}
