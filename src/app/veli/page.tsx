import Link from "next/link";
import { readData } from "@/lib/store";
import { Badge, Card } from "@/components/ui";
import { formatDateTime, formatMoney, formatTime } from "@/lib/utils";
import { CalendarDays, Home, Music2, RefreshCcw, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

/** Demo veli portalı — örnek: Selin Arslan (Zeynep'in velisi) */
export default async function VeliPortalPage() {
  const data = await readData();
  // Demo: ilk öğrencinin velisi gibi göster; gerçekte login olur
  const student = data.students.find((s) => s.id === "s1") ?? data.students[0];
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
          <Link href="/" className="text-xs text-violet-600">
            <Home className="h-4 w-4" />
          </Link>
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
                    <Badge status={l.type === "makeup" ? "makeup" : l.status} />
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
          <div className="space-y-2">
            {payments.map((p) => (
              <Card key={p.id} className="!p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.description}</p>
                    <p className="text-xs text-slate-500">{formatMoney(p.amount)}</p>
                  </div>
                  <Badge status={p.status} />
                </div>
              </Card>
            ))}
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
