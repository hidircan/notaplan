import Link from "next/link";
import { redirect } from "next/navigation";
import { isSameDay, parseISO, startOfMonth, endOfMonth, format } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  RefreshCcw,
  Users,
  GraduationCap,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Badge, Button, Card, PageHeader, StatCard } from "@/components/ui";
import { getDashboardStats } from "@/lib/store";
import { actionResetDemo } from "@/lib/actions";
import { formatDateTime, formatMoney, formatTime } from "@/lib/utils";
import { buildDemoMessages } from "@/lib/whatsapp-templates";
import { computeSetupProgress } from "@/lib/setup-progress";
import { computeTeacherPayoutOverview } from "@/lib/teacher-payout-overview";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";

export const dynamic = "force-dynamic";

type ActionTone = "rose" | "amber" | "gold" | "sky";

const TONE_CLASSES: Record<ActionTone, string> = {
  rose: "block rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3 text-rose-900 transition hover:bg-rose-100",
  amber:
    "block rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-amber-900 transition hover:bg-amber-100",
  gold: "block rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] px-4 py-3 text-[var(--color-primary-soft-text)] transition hover:bg-[var(--color-primary-soft)]/70",
  sky: "block rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-3 text-sky-900 transition hover:bg-sky-100",
};

export default async function DashboardPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel");
  }
  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);
  const stats = getDashboardStats(data);
  const setupProgress = computeSetupProgress(data);
  const today = new Date().toISOString().slice(0, 10);
  const todayLessons = data.lessons
    .filter((l) => l.startAt.startsWith(today))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const openMakeupRequests = data.makeupRequests.filter(
    (m) => m.status === "pending" || m.status === "suggested" || m.status === "awaiting_info"
  );
  const openMakeups = openMakeupRequests.slice(0, 5);

  const urgentPayments = data.payments
    .filter((p) => p.status === "overdue" || p.status === "partial")
    .slice(0, 4);

  // Bugünün aksiyonları — yalnızca gerçekten aksiyon gerektiren kalemler
  const unpaidPayments = data.payments.filter((p) => p.status !== "paid");
  const totalOutstanding = unpaidPayments.reduce(
    (sum, p) => sum + Math.max(p.amount - p.paidAmount, 0),
    0
  );
  const hasOverduePayment = unpaidPayments.some((p) => p.status === "overdue");

  const now = new Date();
  const attendedLessonIds = new Set(data.attendances.map((a) => a.lessonId));
  const pendingAttendanceLessons = data.lessons.filter(
    (l) =>
      l.status === "scheduled" &&
      isSameDay(parseISO(l.startAt), now) &&
      parseISO(l.startAt) <= now &&
      !attendedLessonIds.has(l.id)
  );

  const pendingMessageCount = buildDemoMessages(data).length;

  const monthPeriodStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthPeriodEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const payoutOverview = computeTeacherPayoutOverview(data, monthPeriodStart, monthPeriodEnd);

  const actionCards: { key: string; href: string; label: string; detail: string; tone: ActionTone }[] = [];

  if (totalOutstanding > 0) {
    actionCards.push({
      key: "tahsilat",
      href: "/panel/ai/tahsilat-agent",
      label: hasOverduePayment ? "Gecikmiş tahsilat" : "Bekleyen tahsilat",
      detail: formatMoney(totalOutstanding),
      tone: hasOverduePayment ? "rose" : "amber",
    });
  }

  if (openMakeupRequests.length > 0) {
    actionCards.push({
      key: "telafi",
      href: "/panel/telafi",
      label: "Telafi bekliyor",
      detail: `${openMakeupRequests.length} talep`,
      tone: "amber",
    });
  }

  if (pendingAttendanceLessons.length > 0) {
    actionCards.push({
      key: "yoklama",
      href: "/panel/yoklama",
      label: "Yoklama bekliyor",
      detail: `${pendingAttendanceLessons.length} ders`,
      tone: "gold",
    });
  }

  if (pendingMessageCount > 0) {
    actionCards.push({
      key: "bildirim",
      href: "/panel/bildirimler",
      label: "Bekleyen WhatsApp mesajı",
      detail: `${pendingMessageCount} mesaj`,
      tone: "sky",
    });
  }

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
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

      {!setupProgress.isReady && (
        <Link
          href="/panel/kurulum"
          className="mb-6 inline-block text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          Okul kurulumunu tamamla ({setupProgress.completedCount}/{setupProgress.totalCount}) →
        </Link>
      )}

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Bugünün aksiyonları</h2>
        {actionCards.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
            Bugün için bekleyen aksiyon bulunmuyor.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actionCards.map((card) => (
              <Link key={card.key} href={card.href} className={TONE_CLASSES[card.tone]}>
                <p className="text-sm font-semibold">{card.label}</p>
                <p className="mt-1 text-lg font-semibold">{card.detail}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bugünkü dersler"
          value={stats.todayLessonCount}
          hint="Planlanan seanslar"
          accent="primary"
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <StatCard
          label="Açık telafi"
          value={stats.pendingMakeup}
          hint={`${stats.confirmedMakeup} onaylı telafi`}
          accent="warning"
          icon={<RefreshCcw className="h-5 w-5" />}
        />
        <StatCard
          label="Aktif öğrenci"
          value={stats.activeStudents}
          hint={`${stats.activeTeachers} öğretmen`}
          accent="info"
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <StatCard
          label="Tahsil edilen"
          value={formatMoney(stats.revenuePaid)}
          hint={`${formatMoney(stats.revenueDue)} bekleyen`}
          accent="success"
          icon={<CreditCard className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Bugünün programı</h2>
            <Link href="/panel/program" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
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
              className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
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

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-semibold text-slate-900">Öğretmen Hakedişleri</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-lg font-semibold text-amber-700">
                  {formatMoney(payoutOverview.pendingTotal)}
                </p>
                <p className="text-[11px] text-slate-500">Bu ay bekleyen</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-lg font-semibold text-emerald-700">
                  {formatMoney(payoutOverview.paidTotal)}
                </p>
                <p className="text-[11px] text-slate-500">Bu ay ödenen</p>
              </div>
            </div>
            {payoutOverview.missingFeeRuleLessonCount > 0 ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {payoutOverview.missingFeeRuleLessonCount} tamamlanmış derste ücret kuralı eksik —
                hakediş eksiksiz hesaplanamıyor.
              </p>
            ) : null}
            <Link
              href="/panel/ogretmenler"
              className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              Hakedişleri görüntüle →
            </Link>
          </Card>
        </div>
      </div>

      <Card className="mt-6 border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 shadow-sm">
              <Users className="h-5 w-5 text-[var(--color-primary)]" />
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
