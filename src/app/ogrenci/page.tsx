import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, BookOpen, CalendarDays, FileText, Home, Megaphone, Music2, Video } from "lucide-react";
import { requireSessionContext } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { listAnnouncementsForUserTool, listCurriculumForStudentTool } from "@/lib/services";
import { listNotificationsForUser } from "@/lib/notifications";
import { NotificationList } from "@/components/notification-list";
import { LogoutButton } from "@/components/logout-button";
import { Badge, Card } from "@/components/ui";
import { LessonOpsBadges } from "@/components/lesson-ops-actions";
import { formatDateTime } from "@/lib/utils";
import { computeLiveDisplayStatus } from "@/lib/lesson-live-status";

export const dynamic = "force-dynamic";

/**
 * EPIC 6A/6B (IMPLEMENTATION_PLAN.md) — STUDENT rolü portalı. 6A'da yalnızca
 * program/bildirim/duyuru/gelişim raporuydu; 6B ile ödev ve materyal
 * bağlantıları eklendi (kendi alt-sayfaları, bkz. /ogrenci/odevlerim ve
 * /ogrenci/materyaller).
 */
export default async function OgrenciPortalPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/ogrenci");
  }
  if (session.role === "TEACHER") redirect("/ogretmen");
  if (session.role === "PARENT") redirect("/veli");
  if (session.role === "SCHOOL_ADMIN" || session.role === "SUPER_ADMIN") {
    // admins may preview; fall through
  } else if (session.role !== "STUDENT" && session.role !== "AI_AGENT") {
    redirect("/login?next=/ogrenci");
  }

  const data = await readData();
  const studentId = session.studentId;
  if (!studentId) redirect("/login");
  const student = data.students.find((s) => s.id === studentId);
  if (!student) redirect("/login");

  // Pasif/arşivlenmiş öğrenci: portala girebilir ama HİÇBİR ders/ödev/materyal/
  // rapor verisi görmez — yalnız güvenli, açıklayıcı bir ekran. Veri sızıntısı yok.
  if (!student.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-slate-50 px-4">
        <Card className="max-w-sm text-center">
          <p className="text-sm font-semibold text-slate-900">Hesabınız pasif durumda</p>
          <p className="mt-2 text-sm text-slate-600">
            Kaydınız kurum tarafından pasife alınmış. Ders, ödev, materyal ve rapor
            bilgilerine erişim geçici olarak kapalı. Sorularınız için kurumla iletişime
            geçin.
          </p>
          <div className="mt-4">
            <LogoutButton className="!text-xs" />
          </div>
        </Card>
      </div>
    );
  }

  const teacher = data.teachers.find((t) => t.id === student.teacherId);

  const upcoming = data.lessons
    .filter(
      (l) =>
        l.studentId === student.id &&
        (l.status === "scheduled" || l.status === "in_progress") &&
        new Date(l.startAt) >= new Date()
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5);

  const past = data.lessons
    .filter((l) => l.studentId === student.id && new Date(l.startAt) < new Date())
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 5);

  const notifications = await listNotificationsForUser({
    tenantId: data.settings.tenantId,
    userId: session.userId,
    studentId: student.id,
  });

  const announcementsResult = await listAnnouncementsForUserTool(session);
  const announcements = announcementsResult.ok ? announcementsResult.data.announcements : [];

  const curriculumResult = await listCurriculumForStudentTool(session, { studentId: student.id });
  const overallPercent = curriculumResult.ok ? curriculumResult.data.overallPercent : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50">
      <header className="border-b border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Music2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{data.settings.shortName}</p>
              <p className="text-[11px] text-slate-500">Öğrenci portalı</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LogoutButton className="!text-xs text-slate-500" />
            <Link href="/" className="text-xs text-emerald-600">
              <Home className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
        <Card className="border-emerald-100 bg-white">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Merhaba</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{student.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {student.instruments.join(", ")} · Öğretmen: {teacher?.name ?? "—"}
          </p>
        </Card>

        {student.studentType || student.level || student.targetExam || student.educationMethod ? (
          <Card className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Program bilgim</p>
            <div className="mt-1 space-y-0.5 text-sm text-slate-600">
              {student.studentType ? <p>Tür: {student.studentType}</p> : null}
              {student.level ? <p>Seviye: {student.level}</p> : null}
              {student.educationMethod ? <p>Eğitim metodu: {student.educationMethod}</p> : null}
              {student.targetExam ? <p>Hedef sınav: {student.targetExam}</p> : null}
            </div>
          </Card>
        ) : null}

        {overallPercent !== null ? (
          <Link href="/ogrenci/mufredat">
            <Card className="!p-4 hover:border-emerald-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Müfredat ilerlemem</p>
                <p className="text-sm font-semibold text-emerald-600">%{overallPercent}</p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.max(0, Math.min(100, overallPercent))}%` }}
                />
              </div>
            </Card>
          </Link>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Link href="/ogrenci/odevlerim">
            <Card className="!p-4 hover:border-emerald-200">
              <BookOpen className="h-4 w-4 text-emerald-600" />
              <p className="mt-1 text-sm font-semibold text-slate-900">Ödevlerim</p>
            </Card>
          </Link>
          <Link href="/ogrenci/materyaller">
            <Card className="!p-4 hover:border-emerald-200">
              <Video className="h-4 w-4 text-emerald-600" />
              <p className="mt-1 text-sm font-semibold text-slate-900">Materyaller</p>
            </Card>
          </Link>
          <Link href="/ogrenci/mufredat" className="col-span-2">
            <Card className="!p-4 hover:border-emerald-200">
              <p className="text-sm font-semibold text-slate-900">Müfredatım</p>
              <p className="mt-0.5 text-xs text-slate-500">Konu hedefleri ve ilerleme özeti</p>
            </Card>
          </Link>
        </div>

        <Link href={`/degerlendirme/rapor/${student.id}`}>
          <Card className="!p-4 hover:border-emerald-200">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-900">Gelişim raporunu görüntüle</p>
            </div>
          </Card>
        </Link>

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Bell className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">Bildirimler</h2>
          </div>
          <NotificationList notifications={notifications} />
        </section>

        {announcements.length > 0 ? (
          <section>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Megaphone className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-800">Duyurular</h2>
            </div>
            <div className="space-y-2">
              {announcements.map((a) => (
                <Card key={a.id} className={a.pinned ? "!p-4 border-emerald-200 bg-emerald-50/60" : "!p-4"}>
                  <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{a.body}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
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
                    <p className="font-medium text-slate-900">{formatDateTime(l.startAt)}</p>
                    <Badge status={l.type === "makeup" ? "makeup" : computeLiveDisplayStatus(l)} />
                  </div>
                  <p className="text-sm text-slate-500">{l.instrument}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">Geçmiş dersler</h2>
          </div>
          {past.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">Henüz geçmiş ders yok.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {past.map((l) => (
                <Card key={l.id} className="!p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{formatDateTime(l.startAt)}</p>
                    <Badge status={l.type === "makeup" ? "makeup" : l.status} />
                  </div>
                  <p className="text-sm text-slate-500">{l.instrument}</p>
                  <div className="mt-1.5">
                    <LessonOpsBadges
                      studentAttended={l.studentAttended}
                      lessonProcessed={l.lessonProcessed}
                      opsMakeupFlag={l.opsMakeupFlag}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <p className="px-1 text-center text-[11px] text-slate-400">
          Demo görünüm ·{" "}
          <Link href="/panel" className="text-emerald-600">
            Yönetim paneli
          </Link>
        </p>
      </main>
    </div>
  );
}
