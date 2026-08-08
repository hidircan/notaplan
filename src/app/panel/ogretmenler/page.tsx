import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, Wallet } from "lucide-react";
import { actionAddTeacher } from "@/lib/actions";
import { Badge, Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { dayName } from "@/lib/utils";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { computeTeacherPerformanceScore } from "@/lib/insights/teacher-performance";
import { TeacherInstrumentsField } from "@/components/teacher-instruments-field";
import { TeacherAvailabilityField } from "@/components/teacher-availability-field";
import { AiInsightTrigger } from "@/components/ai/ai-insight-trigger";
import { TeacherArchiveAction } from "@/components/teacher-archive-action";
import { listInstrumentCatalogTool } from "@/lib/services";
import type { Instrument } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OgretmenlerPage({
  searchParams,
}: {
  searchParams?: Promise<{ durum?: string }>;
} = {}) {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/ogretmenler");
  }
  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);
  const canSeePerformance = session.role === "SUPER_ADMIN" || session.role === "SCHOOL_ADMIN";
  const canManage = session.role === "SCHOOL_ADMIN" || session.role === "SUPER_ADMIN";

  // ÖNCELİK 4 (devam) — Yönetilebilir Enstrüman Kataloğu: statik küme + tenant'ın aktif ek enstrümanları.
  const catalogResult = await listInstrumentCatalogTool(session, {});
  const instrumentOptions = (
    catalogResult.ok
      ? [...catalogResult.data.staticInstruments, ...catalogResult.data.entries.filter((e) => e.status === "active").map((e) => e.name)]
      : undefined
  ) as Instrument[] | undefined;

  // ÖNCELİK 4 (devam) — varsayılan yalnız Aktif Öğretmenler; "Arşivlenmiş
  // Öğretmenler" ayrı bir sekme/filtre. Arşiv öğretmenler burada dahi (CSV
  // eşleştirme, yeni ders/öğrenci öğretmen seçicisi vb.) hiç seçilebilir
  // olarak sunulmaz — yalnız görüntüleme + "Yeniden Aktifleştir" amaçlıdır.
  const { durum } = (await searchParams) ?? {};
  const showArchived = durum === "arsiv";
  const visibleTeachers = data.teachers.filter((t) => (showArchived ? !t.active : t.active));

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <PageHeader
        title="Öğretmenler"
        description="Müsaitlik pencereleri telafi motoru tarafından kullanılır."
      />

      <div className="mb-4 flex items-center gap-1 rounded-md border border-slate-200 p-0.5 dark:border-slate-700" role="tablist" aria-label="Öğretmen durumu">
        <Link
          href="/panel/ogretmenler"
          role="tab"
          aria-selected={!showArchived}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            !showArchived ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400"
          }`}
        >
          Aktif Öğretmenler
        </Link>
        <Link
          href="/panel/ogretmenler?durum=arsiv"
          role="tab"
          aria-selected={showArchived}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            showArchived ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400"
          }`}
        >
          Arşivlenmiş Öğretmenler
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {visibleTeachers.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {showArchived ? "Arşivlenmiş öğretmen yok." : "Aktif öğretmen yok."}
              </p>
            </Card>
          ) : null}
          {visibleTeachers.map((t) => {
            const studentCount = data.students.filter((s) => s.teacherId === t.id && s.active).length;
            const weekLessons = data.lessons.filter((l) => l.teacherId === t.id && l.status !== "cancelled").length;
            return (
              <Card key={t.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
                      style={{ background: t.color }}
                    >
                      {t.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <Link
                        href={`/panel/ogretmenler/${t.id}`}
                        className="font-semibold text-slate-900 hover:text-[var(--color-primary)] dark:text-slate-50"
                      >
                        {t.name}
                      </Link>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {data.settings.branches.find((b) => b.id === t.branchId)?.shortName} ·{" "}
                        {t.email} · {t.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1">
                      {t.instruments.map((i) => (
                        <Badge key={i}>{i}</Badge>
                      ))}
                    </div>
                    {canManage ? (
                      <TeacherArchiveAction teacherId={t.id} teacherName={t.name} archived={!t.active} />
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Öğrenci</p>
                    <p className="text-lg font-semibold">{studentCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Kayıtlı ders</p>
                    <p className="text-lg font-semibold">{weekLessons}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Günlük limit</p>
                    <p className="text-lg font-semibold">{t.maxDailyLessons}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Müsaitlik
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {t.availability.map((a) => (
                      <span
                        key={`${a.dayOfWeek}-${a.start}`}
                        className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800"
                      >
                        {dayName(a.dayOfWeek)} {a.start}–{a.end}
                      </span>
                    ))}
                  </div>
                </div>

                {canSeePerformance ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {(() => {
                      const perf = computeTeacherPerformanceScore(data, t.id);
                      return (
                        <>
                          <p className="mb-2 text-sm text-slate-700 dark:text-slate-300">
                            Performans skoru:{" "}
                            <span className="font-semibold text-slate-900 dark:text-slate-50">
                              {perf.score === null ? "yetersiz veri" : `${perf.score}/100`}
                            </span>{" "}
                            <span className="text-xs text-slate-400">
                              ({perf.gradedLessonCount} işlenmiş ders · {perf.presentCount} geldi ·{" "}
                              {perf.schoolCancelledCount} okul iptal)
                            </span>
                          </p>
                          <AiInsightTrigger
                            capabilityId="teacherPerformanceScore"
                            label="AI ile yorumla"
                            payload={{ teacherName: t.name, ...perf }}
                          />
                        </>
                      );
                    })()}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Link
                    href={`/panel/ogretmenler/${t.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-soft-text)] hover:bg-[var(--color-primary-soft)]/70"
                  >
                    Detay
                  </Link>
                  <Link
                    href={`/panel/ogretmenler/${t.id}/hakedis`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Hakediş
                  </Link>
                  <Link
                    href={`/panel/ogretmenler/${t.id}/odemeler`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Ödeme geçmişi
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-50">Yeni öğretmen</h2>
          {kurum.scope.mode !== "single" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              &quot;Tüm kurumlar&quot; görünümündesiniz — yeni öğretmen eklemek için üstteki kurum
              seçiciden tek bir kurum seçin.
            </p>
          ) : (
          <form action={actionAddTeacher} className="space-y-3">
            <div>
              <Label>Ad soyad</Label>
              <Input name="name" required placeholder="Örn. Selin Kara" />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input name="email" type="email" placeholder="ogretmen@okul.com" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input name="phone" placeholder="05xx xxx xxxx" />
            </div>
            <div>
              {/* T.C. kimlik — şifreli saklanır (setNationalIdTool), listede/exportta asla düz metin görünmez. */}
              <Label>T.C. kimlik no (opsiyonel — şifreli saklanır)</Label>
              <Input name="nationalId" inputMode="numeric" maxLength={11} placeholder="11 haneli" />
            </div>
            <div>
              <Label>Ana enstrüman (yalnızca hiç enstrüman eklenmezse kullanılır)</Label>
              <Select name="instrument" defaultValue={instrumentOptions?.[0] ?? "Piyano"}>
                {(instrumentOptions ?? ["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]).map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Enstrümanlar ve seviyeleri</Label>
              <TeacherInstrumentsField name="instrumentLevelsJson" instrumentOptions={instrumentOptions} />
            </div>
            <div>
              <Label>Şube</Label>
              <Select name="branchId" defaultValue={data.settings.branches[0]?.id}>
                {data.settings.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Haftalık müsaitlik (şube bazlı — opsiyonel)</Label>
              <TeacherAvailabilityField
                name="availabilityJson"
                branches={data.settings.branches.map((b) => ({ id: b.id, name: b.name }))}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Şube seçilmezse pencere tüm şubeler için geçerli sayılır. Daha sonra öğretmen detay ekranından da düzenlenebilir.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Öğretmen ekle
            </Button>
          </form>
          )}
        </Card>
      </div>
    </div>
  );
}
