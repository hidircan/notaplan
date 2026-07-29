import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  RefreshCcw,
  Users,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, PageHeader, StatCard } from "@/components/ui";
import { getDashboardStats, readData } from "@/lib/store";
import { actionResetDemo } from "@/lib/actions";
import { formatDateTime, formatMoney, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await readData();
  const stats = getDashboardStats(data);
  const today = new Date().toISOString().slice(0, 10);
  const todayLessons = data.lessons
    .filter((l) => l.startAt.startsWith(today))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const openMakeups = data.makeupRequests
    .filter((m) => m.status === "pending" || m.status === "suggested")
    .slice(0, 5);

  const urgentPayments = data.payments
    .filter((p) => p.status === "overdue" || p.status === "partial")
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Günlük özet"
        description={`${data.settings.name} demo paneli — Erzene & Evka 3 için günlük ders programı, açık telafiler ve tahsilat uyarılarını gösterir.`}
        actions={
          <>
            <Link href="/panel/telafi">
              <Button>
                <Sparkles className="h-4 w-4" />
                Telafi Merkezi
              </Button>
            </Link>
            <form action={actionResetDemo}>
              <Button type="submit" variant="secondary">
                Demo verisini sıfırla
              </Button>
            </form>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bugünkü dersler"
          value={stats.todayLessonCount}
          hint="Planlanan seanslar"
          accent="violet"
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <StatCard
          label="Açık telafi"
          value={stats.pendingMakeup}
          hint={`${stats.confirmedMakeup} onaylı telafi`}
          accent="amber"
          icon={<RefreshCcw className="h-5 w-5" />}
        />
        <StatCard
          label="Aktif öğrenci"
          value={stats.activeStudents}
          hint={`${stats.activeTeachers} öğretmen`}
          accent="sky"
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <StatCard
          label="Tahsil edilen"
          value={formatMoney(stats.revenuePaid)}
          hint={`${formatMoney(stats.revenueDue)} bekleyen`}
          accent="emerald"
          icon={<CreditCard className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Bugünün programı</h2>
            <Link href="/panel/program" className="text-sm font-medium text-violet-600 hover:text-violet-700">
              Tüm program →
            </Link>
          </div>
          {todayLessons.length === 0 ? (
            <p className="text-sm text-slate-500">Bugün planlanmış ders yok.</p>
          ) : (
            <div className="space-y-3">
              {todayLessons.map((lesson) => {
                const student = data.students.find((s) => s.id === lesson.studentId);
                const teacher = data.teachers.find((t) => t.id === lesson.teacherId);
                const room = data.rooms.find((r) => r.id === lesson.roomId);
                const branch = data.settings.branches.find((b) => b.id === lesson.branchId);
                return (
                  <div
                    key={lesson.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-1 rounded-full"
                        style={{ background: teacher?.color ?? "#7c3aed" }}
                      />
                      <div>
                        <p className="font-medium text-slate-900">
                          {formatTime(lesson.startAt)}–{formatTime(lesson.endAt)} · {lesson.instrument}
                        </p>
                        <p className="text-sm text-slate-500">
                          {student?.name} · {teacher?.name} · {branch?.shortName} · {room?.name}
                        </p>
                      </div>
                    </div>
                    <Badge status={lesson.type === "makeup" ? "makeup" : lesson.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-amber-600" />
              <h2 className="font-semibold text-slate-900">Bekleyen telafiler</h2>
            </div>
            {openMakeups.length === 0 ? (
              <p className="text-sm text-slate-500">Açık telafi yok — harika!</p>
            ) : (
              <ul className="space-y-3">
                {openMakeups.map((m) => {
                  const student = data.students.find((s) => s.id === m.studentId);
                  return (
                    <li key={m.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{student?.name}</p>
                          <p className="text-xs text-slate-500">
                            {m.instrument} · {m.reason}
                          </p>
                        </div>
                        <Badge status={m.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Son tarih: {formatDateTime(m.expiresAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/panel/telafi"
              className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              Telafi merkezine git →
            </Link>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <h2 className="font-semibold text-slate-900">Tahsilat uyarısı</h2>
            </div>
            {urgentPayments.length === 0 ? (
              <p className="text-sm text-slate-500">Geciken ödeme yok.</p>
            ) : (
              <ul className="space-y-2">
                {urgentPayments.map((p) => {
                  const student = data.students.find((s) => s.id === p.studentId);
                  return (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{student?.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatMoney(p.amount - p.paidAmount)}</span>
                        <Badge status={p.status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6 border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 shadow-sm">
              <Users className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Satış demo senaryosu</p>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                1) Yoklamada devamsızlık işaretle → 2) Telafi hakkı oluşsun → 3) Otomatik slot öner → 4)
                Onayla ve programa yaz. Bu akış müzik okulu müdürünün günlük işini destekler.
              </p>
            </div>
          </div>
          <Link href="/panel/yoklama">
            <Button>Demo akışını başlat</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
