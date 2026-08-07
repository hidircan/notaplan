import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { WeekDatePicker } from "@/components/week-date-picker";
import { ProgramStudio } from "@/components/program-studio";
import { ProgramTermYearNav, type ProgramTerm } from "@/components/program-term-year-nav";
import { currentAcademicAnchorYear } from "@/lib/attendance-calendar";
import { addDays, startOfWeek } from "@/lib/utils";
import { format, isSameDay, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { AssistantPageContext } from "@/components/ai/assistant-page-context";
import { listInstrumentCatalogTool } from "@/lib/services";

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
  searchParams: Promise<{ week?: string; studentId?: string; progTerm?: string; progYear?: string }>;
}) {
  const { week, studentId, progTerm, progYear } = await searchParams;
  const selectedTerm: ProgramTerm = progTerm === "yaz" ? "yaz" : "guz";
  const parsedYear = progYear ? Number(progYear) : NaN;
  const selectedAcademicYearStart = Number.isFinite(parsedYear) ? parsedYear : currentAcademicAnchorYear(selectedTerm);
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/program");
  }
  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);
  // ÖNCELİK 4 (devam) — Yönetilebilir Enstrüman Kataloğu: statik küme +
  // tenant'ın aktif ek enstrümanları, ders planlama seçicilerine akar.
  const catalogResult = await listInstrumentCatalogTool(session, {});
  const catalogInstruments = catalogResult.ok
    ? [...catalogResult.data.staticInstruments, ...catalogResult.data.entries.filter((e) => e.status === "active").map((e) => e.name)]
    : undefined;
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

  const branchNames = Object.fromEntries(data.settings.branches.map((b) => [b.id, b.shortName]));

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <AssistantPageContext entity={{ kind: "page", label: "Ders Programı" }} />
      <PageHeader
        title="Ders programı"
        description="Öğretmen ve stüdyo bazında haftalık ders görünümü."
      />

      <ProgramTermYearNav term={selectedTerm} academicYearStart={selectedAcademicYearStart} />

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
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            Bugün
          </Link>
        )}

        <WeekDatePicker value={weekStartParam} />
      </div>

      <ProgramStudio
        students={data.students}
        teachers={data.teachers}
        rooms={data.rooms}
        branchNames={branchNames}
        canCreate={kurum.scope.mode === "single"}
        workingHours={data.settings.workingHours}
        days={days.map((d) => d.toISOString())}
        weekLessons={weekLessons}
        todayIso={new Date().toISOString()}
        initialStudentFilter={studentId}
        selectedTerm={selectedTerm}
        selectedAcademicYearStart={selectedAcademicYearStart}
        catalogInstruments={catalogInstruments}
      />

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-50">Stüdyolar</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.rooms.map((room) => (
            <div key={room.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{room.name}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
