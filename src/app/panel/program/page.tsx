import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { readData } from "@/lib/store";
import { Badge, Card, PageHeader } from "@/components/ui";
import { WeekDatePicker } from "@/components/week-date-picker";
import { addDays, formatDate, formatTime, startOfWeek } from "@/lib/utils";
import { format, isSameDay, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

export const dynamic = "force-dynamic";

const WEEK_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function resolveWeekStart(weekParam?: string): Date {
  if (weekParam && WEEK_PARAM_PATTERN.test(weekParam)) {
    const parsed = parseISO(weekParam);
    if (!Number.isNaN(parsed.getTime())) {
      return startOfWeek(parsed, { weekStartsOn: 1 });
    }
  }
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

export default async function ProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const data = await readData();
  const weekStart = resolveWeekStart(week);
  const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const isCurrentWeek = isSameDay(weekStart, todayWeekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartParam = format(weekStart, "yyyy-MM-dd");
  const prevWeekParam = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const nextWeekParam = format(addDays(weekStart, 7), "yyyy-MM-dd");
  const todayParam = format(todayWeekStart, "yyyy-MM-dd");

  const weekLessons = data.lessons.filter((l) => {
    const d = parseISO(l.startAt);
    return d >= days[0] && d <= addDays(days[6], 1);
  });

  return (
    <div>
      <PageHeader
        title="Ders programı"
        description="Öğretmen ve stüdyo bazında haftalık ders görünümü."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/panel/program?week=${prevWeekParam}`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> Önceki hafta
        </Link>

        <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
          {format(weekStart, "d MMM", { locale: tr })} –{" "}
          {format(addDays(weekStart, 6), "d MMM yyyy", { locale: tr })}
        </span>

        <Link
          href={`/panel/program?week=${nextWeekParam}`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sonraki hafta <ChevronRight className="h-4 w-4" />
        </Link>

        {isCurrentWeek ? (
          <span className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-400">
            Bugün
          </span>
        ) : (
          <Link
            href={`/panel/program?week=${todayParam}`}
            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
          >
            Bugün
          </Link>
        )}

        <WeekDatePicker value={weekStartParam} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {data.teachers.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
            {t.name}
          </span>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const dayLessons = weekLessons
            .filter((l) => isSameDay(parseISO(l.startAt), day))
            .sort((a, b) => a.startAt.localeCompare(b.startAt));

          return (
            <Card key={day.toISOString()} className="min-h-[220px] p-3">
              <div className="mb-3 border-b border-slate-100 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {format(day, "EEEE", { locale: tr })}
                </p>
                <p className="text-sm font-semibold text-slate-900">{formatDate(day.toISOString(), "d MMM")}</p>
              </div>
              <div className="space-y-2">
                {dayLessons.length === 0 ? (
                  <p className="text-xs text-slate-400">Boş</p>
                ) : (
                  dayLessons.map((lesson) => {
                    const student = data.students.find((s) => s.id === lesson.studentId);
                    const teacher = data.teachers.find((t) => t.id === lesson.teacherId);
                    const branch = data.settings.branches.find((b) => b.id === lesson.branchId);
                    return (
                      <div
                        key={lesson.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs"
                        style={{ borderLeft: `3px solid ${teacher?.color ?? "#7c3aed"}` }}
                      >
                        <p className="font-semibold text-slate-800">
                          {formatTime(lesson.startAt)} {lesson.instrument}
                        </p>
                        <p className="text-slate-600">{student?.name}</p>
                        <p className="text-slate-400">
                          {teacher?.name} · {branch?.shortName}
                        </p>
                        <div className="mt-1">
                          <Badge status={lesson.type === "makeup" ? "makeup" : lesson.status} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-slate-900">Stüdyolar</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.rooms.map((room) => (
            <div key={room.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">{room.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {data.settings.branches.find((b) => b.id === room.branchId)?.shortName} · Kapasite{" "}
                {room.capacity} · {room.instruments.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
