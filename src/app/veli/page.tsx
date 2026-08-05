import Link from "next/link";
import { redirect } from "next/navigation";
import { readData } from "@/lib/store";
import { Badge, Card } from "@/components/ui";
import { formatDate, formatDateTime, formatMoney, formatTime } from "@/lib/utils";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  Home,
  Megaphone,
  MessageCircle,
  Music2,
  RefreshCcw,
  CreditCard,
  Star,
} from "lucide-react";
import { requireSessionContext } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { listNotificationsForUser } from "@/lib/notifications";
import { NotificationList } from "@/components/notification-list";
import { listAnnouncementsForUserTool } from "@/lib/services";
import { computeLiveDisplayStatus } from "@/lib/lesson-live-status";

export const dynamic = "force-dynamic";

function phoneToWa(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.startsWith("90")) return digits;
  return digits;
}

/** Veli portalı — oturumdaki studentId ile kapsamlanır */
export default async function VeliPortalPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/veli");
  }
  if (session.role === "TEACHER") redirect("/ogretmen");
  if (session.role === "SCHOOL_ADMIN" || session.role === "SUPER_ADMIN") {
    // admins may preview; fall through
  } else if (session.role !== "PARENT" && session.role !== "AI_AGENT") {
    redirect("/login?next=/veli");
  }

  const data = await readData();
  const studentId = session.studentId || "s1";
  const student = data.students.find((s) => s.id === studentId) ?? data.students[0];
  if (!student) redirect("/login");
  const teacher = data.teachers.find((t) => t.id === student.teacherId);
  const branch = data.settings.branches.find((b) => b.id === student.branchId);

  const lessons = data.lessons
    .filter((l) => l.studentId === student.id)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const upcoming = lessons.filter(
    (l) => l.status === "scheduled" && new Date(l.startAt) >= new Date()
  );
  const past = lessons.filter((l) => new Date(l.startAt) < new Date()).slice(-5).reverse();

  const makeups = data.makeupRequests.filter((m) => m.studentId === student.id);
  const payments = data.payments.filter((p) => p.studentId === student.id);

  const notifications = await listNotificationsForUser({
    tenantId: data.settings.tenantId,
    userId: session.userId,
    studentId: student.id,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const announcementsResult = await listAnnouncementsForUserTool(session);
  const announcements = announcementsResult.ok ? announcementsResult.data.announcements : [];

  const confirmedUpcomingMakeups = [];
  for (const m of makeups) {
    if (m.status !== "confirmed" || !m.confirmedLessonId) continue;
    const lesson = data.lessons.find((l) => l.id === m.confirmedLessonId);
    if (!lesson) continue;
    if (new Date(lesson.startAt) < new Date()) continue;
    confirmedUpcomingMakeups.push({ request: m, lesson });
  }
  confirmedUpcomingMakeups.sort((a, b) => a.lesson.startAt.localeCompare(b.lesson.startAt));
  const hasMakeupHighlight = confirmedUpcomingMakeups.length > 0;

  const unpaidPayments = payments.filter((p) => p.status !== "paid");
  const totalOutstanding = unpaidPayments.reduce(
    (sum, p) => sum + Math.max(p.amount - p.paidAmount, 0),
    0
  );
  const hasOverduePayment = unpaidPayments.some((p) => p.status === "overdue");

  const schoolPhone = data.settings.phone;
  const contactMessage = `Merhaba, ${student.name} için ödeme durumu hakkında bilgi almak istiyorum.`;
  const contactWaLink = schoolPhone
    ? `https://wa.me/${phoneToWa(schoolPhone)}?text=${encodeURIComponent(contactMessage)}`
    : null;

  const paymentSummaryCard =
    totalOutstanding > 0 ? (
      <Card
        className={`!p-4 ${hasOverduePayment ? "border-rose-200 bg-rose-50/60" : "border-amber-200 bg-amber-50/60"}`}
      >
        <div className={`flex items-center gap-2 ${hasOverduePayment ? "text-rose-700" : "text-amber-700"}`}>
          <CreditCard className="h-4 w-4" />
          <p className="text-sm font-semibold">
            {hasOverduePayment ? "Gecikmiş ödemeniz var" : "Bekleyen ödemeniz var"}
          </p>
        </div>
        <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(totalOutstanding)}</p>
        <p className="text-xs text-slate-500">Toplam kalan tutar</p>
        {contactWaLink ? (
          <a
            href={contactWaLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Okulla iletişime geç
          </a>
        ) : null}
      </Card>
    ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-slate-50">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Music2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{data.settings.shortName}</p>
              <p className="text-[11px] text-slate-500">Veli portalı</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="#bildirimler" className="relative text-slate-500 dark:text-slate-400">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </a>
            <LogoutButton className="!text-xs text-slate-500" />
            <Link href="/" className="text-xs text-violet-600">
              <Home className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
        <Card className="border-violet-100 bg-white">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600">Veliler için demo</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{student.parentName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Öğrenci: <strong>{student.name}</strong> · {student.instruments.join(", ")}
          </p>
          <p className="text-sm text-slate-500">
            {branch?.name} · Öğretmen: {teacher?.name}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Bu sayfa demo görünümüdür. Gerçekte veli kendi hesabıyla giriş yapar ve telafi / ödeme bilgilerini görür.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/veli/odevler">
            <Card className="!p-4 hover:border-violet-200">
              <BookOpen className="h-4 w-4 text-violet-600" />
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">Ödevler</p>
            </Card>
          </Link>
          <Link href="/veli/degerlendirme">
            <Card className="!p-4 hover:border-violet-200">
              <Star className="h-4 w-4 text-violet-600" />
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">Öğretmeni değerlendir</p>
            </Card>
          </Link>
        </div>

        <section id="bildirimler">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Bell className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Bildirimler</h2>
          </div>
          <NotificationList notifications={notifications} />
        </section>

        {announcements.length > 0 ? (
          <section>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Megaphone className="h-4 w-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Duyurular</h2>
            </div>
            <div className="space-y-2">
              {announcements.map((a) => (
                <Card key={a.id} className={a.pinned ? "!p-4 border-violet-200 bg-violet-50/60" : "!p-4"}>
                  <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{a.body}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <Link href={`/degerlendirme/rapor/${student.id}`}>
          <Card className="!p-4 hover:border-violet-200">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Gelişim raporunu görüntüle
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Öğretmenin hazırladığı değerlendirmeler ve puan trendi.
            </p>
          </Card>
        </Link>

        {hasMakeupHighlight ? (
          <div className="space-y-2">
            {confirmedUpcomingMakeups.map(({ request, lesson }) => {
              const makeupTeacher = data.teachers.find((t) => t.id === lesson.teacherId);
              const makeupBranch = data.settings.branches.find((b) => b.id === lesson.branchId);
              const makeupRoom = data.rooms.find((r) => r.id === lesson.roomId);
              return (
                <Card key={request.id} className="!p-4 border-emerald-200 bg-emerald-50/60">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <p className="text-sm font-semibold">Telafi dersiniz onaylandı</p>
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {formatDateTime(lesson.startAt)}
                  </p>
                  <p className="text-sm text-slate-600">
                    {formatTime(lesson.startAt)}–{formatTime(lesson.endAt)} · {lesson.instrument}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {makeupTeacher?.name} · {makeupBranch?.shortName}
                    {makeupRoom ? ` · ${makeupRoom.name}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-emerald-700">Programınıza eklendi.</p>
                </Card>
              );
            })}
          </div>
        ) : (
          paymentSummaryCard
        )}

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-800">Yaklaşan dersler</h2>
          </div>
          {upcoming.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">Yaklaşan ders yok.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map((l) => (
                <Card key={l.id} className="!p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{formatDateTime(l.startAt)}</p>
                      <p className="text-sm text-slate-500">
                        {formatTime(l.startAt)}–{formatTime(l.endAt)} · {l.instrument}
                        {l.type === "makeup" ? " · Telafi" : ""}
                      </p>
                    </div>
                    <Badge status={l.type === "makeup" ? "makeup" : computeLiveDisplayStatus(l)} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <RefreshCcw className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-800">Telafi hakları</h2>
          </div>
          {makeups.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">Açık telafi yok.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {makeups.map((m) => (
                <Card key={m.id} className="!p-4 border-amber-100 bg-amber-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{m.instrument}</p>
                      <p className="text-sm text-slate-600">{m.reason}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Son: {formatDateTime(m.expiresAt)}
                      </p>
                    </div>
                    <Badge status={m.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Okul sizin için uygun saat önerecek. Onay sonrası burada görünür.
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">Ödemeler</h2>
          </div>
          {hasMakeupHighlight && paymentSummaryCard ? (
            <div className="mb-2">{paymentSummaryCard}</div>
          ) : null}
          <div className="space-y-2">
            {payments.map((p) => {
              const remaining = Math.max(p.amount - p.paidAmount, 0);
              return (
                <Card key={p.id} className="!p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{p.description}</p>
                      <p className="text-xs text-slate-500">
                        {p.status === "partial"
                          ? `Ödenen: ${formatMoney(p.paidAmount)} · Kalan: ${formatMoney(remaining)}`
                          : formatMoney(p.amount)}
                      </p>
                      {p.status !== "paid" ? (
                        <p className="mt-0.5 text-xs text-slate-400">Vade: {formatDate(p.dueDate)}</p>
                      ) : null}
                    </div>
                    <Badge status={p.status} />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-slate-800">Son dersler</h2>
          <div className="space-y-2">
            {past.map((l) => (
              <Card key={l.id} className="!p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{formatDateTime(l.startAt)}</span>
                  <Badge status={l.status} />
                </div>
              </Card>
            ))}
          </div>
        </section>

        <p className="px-1 text-center text-[11px] text-slate-400">
          Demo görünüm · Gerçekte veli telefonu ile giriş yapar ·{" "}
          <Link href="/panel" className="text-violet-600">
            Yönetim paneli
          </Link>
        </p>
      </main>
    </div>
  );
}
