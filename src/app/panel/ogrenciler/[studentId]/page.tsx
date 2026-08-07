import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  RefreshCcw,
  User,
  Users,
} from "lucide-react";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import {
  getAssessmentReportTool,
  listCurriculumForStudentTool,
  listHomeworkForStudentTool,
  listStudentDocumentsTool,
  listTeachingMaterialsForStudentTool,
} from "@/lib/services";
import { computeOverallScore } from "@/lib/assessment/score";
import { computeStudentPaymentSummary, sortPaymentsForProfile } from "@/lib/payment-profile";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { LessonOpsBadges } from "@/components/lesson-ops-actions";
import { AttendanceCalendarPanel } from "@/components/attendance-calendar-panel";
import { StudentArchiveToggle } from "@/components/student-archive-toggle";
import { NationalIdReveal } from "@/components/national-id-reveal";
import { maskNationalId } from "@/lib/pii/tc-identity";
import { canViewFullNationalId } from "@/lib/pii";
import { formatDate, formatDateTime, formatMoney, formatTime } from "@/lib/utils";
import { computeAge } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "#genel", icon: User, label: "Genel Bilgiler" },
  { href: "#veli", icon: Users, label: "Veli ve İletişim" },
  { href: "#program", icon: CalendarDays, label: "Dersler ve Program" },
  { href: "#yoklama", icon: ClipboardCheck, label: "Yoklama" },
  { href: "#yoklama-takvimi", icon: CalendarDays, label: "Yoklama Takvimi" },
  { href: "#telafi", icon: RefreshCcw, label: "Telafiler" },
  { href: "#odeme", icon: CreditCard, label: "Ödemeler" },
  { href: "#gelisim", icon: GraduationCap, label: "Eğitim / Gelişim" },
  { href: "#odev", icon: BookOpen, label: "Ödev / Materyal" },
  { href: "#evrak", icon: FileText, label: "Evraklar" },
] as const;

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/panel/ogrenciler/${studentId}`);
  }

  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);
  const student = data.students.find((s) => s.id === studentId);

  if (!student) {
    return (
      <div>
        <PageHeader title="Öğrenci bulunamadı" />
        <EmptyState
          title="Öğrenci bulunamadı"
          description="Bu kayıt mevcut kurum/şube kapsamınızda değil veya kaldırılmış olabilir."
        />
        <Link href="/panel/ogrenciler" className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
          ← Öğrencilere dön
        </Link>
      </div>
    );
  }

  const teacher = data.teachers.find((t) => t.id === student.teacherId);
  const branch = data.settings.branches.find((b) => b.id === student.branchId);
  const canViewSensitive = session.role === "SUPER_ADMIN" || session.role === "SCHOOL_ADMIN";

  const lessons = data.lessons
    .filter((l) => l.studentId === student.id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  const now = new Date();
  const upcoming = lessons.filter((l) => new Date(l.startAt) >= now).slice(0, 8).reverse();
  const past = lessons.filter((l) => new Date(l.startAt) < now).slice(0, 10);

  const makeupRequests = data.makeupRequests
    .filter((m) => m.studentId === student.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const payments = sortPaymentsForProfile(data.payments.filter((p) => p.studentId === student.id));
  const paymentSummary = computeStudentPaymentSummary(payments);

  const [homeworkResult, materialsResult, curriculumResult, assessmentResult, documentsResult] =
    await Promise.all([
      listHomeworkForStudentTool(session, { studentId: student.id }),
      listTeachingMaterialsForStudentTool(session, { studentId: student.id }),
      listCurriculumForStudentTool(session, { studentId: student.id }),
      getAssessmentReportTool(session, { studentId: student.id }),
      listStudentDocumentsTool(session, { studentId: student.id }),
    ]);
  const homework = homeworkResult.ok ? homeworkResult.data.homework : [];
  const materials = materialsResult.ok ? materialsResult.data.materials : [];
  const curriculumTopics = curriculumResult.ok ? curriculumResult.data.topics : [];
  const curriculumOverall = curriculumResult.ok ? curriculumResult.data.overallPercent : 0;
  const assessments = assessmentResult.ok ? assessmentResult.data.assessments : [];
  const documents = documentsResult.ok ? documentsResult.data.documents : [];

  const age = student.birthDate ? computeAge(student.birthDate) : null;

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <PageHeader
        title={student.name}
        description={`${branch?.shortName ?? "—"} · ${student.packageName.split("—")[0]?.trim() ?? student.packageName}`}
        actions={<StudentArchiveToggle studentId={student.id} active={student.active} />}
      />

      <Card className="mb-6 !p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge status={student.active ? "confirmed" : "cancelled"}>
            {student.active ? "Aktif" : "Pasif"}
          </Badge>
          {student.studentType ? <Badge>{student.studentType}</Badge> : null}
          {student.educationMethod ? <Badge>{student.educationMethod}</Badge> : null}
          <span className="text-sm text-[var(--color-text-muted)]">
            Öğretmen: {teacher?.name ?? "—"} · Kayıt: {student.enrollmentStartDate ? formatDate(student.enrollmentStartDate) : formatDate(student.createdAt)}
          </span>
        </div>
      </Card>

      <nav aria-label="Bölümler" className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.href}
            href={s.href}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
          >
            <s.icon className="h-3.5 w-3.5" aria-hidden />
            {s.label}
          </a>
        ))}
      </nav>

      <section id="genel" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Genel Bilgiler</h2>
        <Card>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Field label="Doğum tarihi" value={student.birthDate ? `${formatDate(student.birthDate)}${age !== null ? ` (${age} yaş)` : ""}` : "Belirtilmemiş"} />
            <Field
              label="T.C. kimlik no"
              custom={
                student.nationalIdCipher ? (
                  <NationalIdReveal
                    entity="student"
                    entityId={student.id}
                    masked={maskNationalId(student.nationalIdLast2)}
                    canReveal={canViewSensitive && canViewFullNationalId(session.role)}
                  />
                ) : (
                  <span className="text-[var(--color-text-muted)]">Girilmemiş</span>
                )
              }
            />
            <Field label="Adres" value={canViewSensitive ? student.address || "Belirtilmemiş" : "Yalnız yetkili rol görebilir"} />
            <Field label="Şube" value={branch?.name ?? "—"} />
            <Field label="Paket" value={student.packageName.split("—")[0]?.trim() ?? student.packageName} />
            <Field label="Eğitim metodu" value={student.educationMethod ?? "Belirtilmemiş"} />
            <Field label="Seviye" value={student.level ?? "Belirtilmemiş"} />
            <Field label="Kayıt başlangıç tarihi" value={student.enrollmentStartDate ? formatDate(student.enrollmentStartDate) : "Belirtilmemiş"} />
            <Field label="Ders süresi" value={student.lessonDurationMinutes ? `${student.lessonDurationMinutes} dk` : "Belirtilmemiş"} />
          </dl>
        </Card>
      </section>

      <section id="veli" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Veli ve İletişim</h2>
        <Card>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Field label="Veli adı" value={student.parentName || "—"} />
            <Field label="Veli telefonu" value={student.parentPhone || "—"} />
            <Field label="Öğrenci telefonu" value={student.phone || "—"} />
            <Field label="E-posta" value={student.email || "—"} />
            <Field label="İletişim tercihi" value={student.communicationOptOut ? "Tahsilat hatırlatmalarından çıktı" : "Standart"} />
          </dl>
          <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] p-3">
            <p className="text-xs font-medium text-[var(--color-text)]">Sosyal medya izni</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Bu kurulumda sosyal medya izin takibi henüz bir veri modeliyle desteklenmiyor
              (PRODUCT_BACKLOG §1.4 tanımlı ama uygulanmamış) — izin durumu burada gösterilemiyor.
            </p>
          </div>
        </Card>
      </section>

      <section id="program" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--color-text)]">
          Dersler ve Ders Programı
          <Link href={`/panel/program?studentId=${student.id}`} className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
            Programda Aç →
          </Link>
        </h2>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Yaklaşan</p>
        {upcoming.length === 0 ? (
          <EmptyState title="Yaklaşan ders yok" />
        ) : (
          <div className="mb-4 space-y-2">
            {upcoming.map((l) => {
              const t = data.teachers.find((tt) => tt.id === l.teacherId);
              return (
                <Card key={l.id} className="!p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{formatDateTime(l.startAt)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{l.instrument} · {t?.name ?? "—"}</p>
                    </div>
                    <Badge status={l.type === "makeup" ? "makeup" : l.status} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Geçmiş</p>
        {past.length === 0 ? (
          <EmptyState title="Geçmiş ders yok" />
        ) : (
          <div className="space-y-2">
            {past.map((l) => (
              <Card key={l.id} className="!p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {formatDate(l.startAt)} · {formatTime(l.startAt)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{l.instrument}</p>
                  </div>
                  <Badge status={l.type === "makeup" ? "makeup" : l.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="yoklama" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Yoklama — Geldi / İşlendi / Telafi</h2>
        {lessons.filter((l) => l.studentAttended || l.lessonProcessed || l.opsMakeupFlag).length === 0 ? (
          <EmptyState title="Henüz yoklama kaydı yok" />
        ) : (
          <div className="space-y-2">
            {lessons
              .filter((l) => l.studentAttended || l.lessonProcessed || l.opsMakeupFlag)
              .slice(0, 15)
              .map((l) => (
                <Card key={l.id} className="!p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-[var(--color-text)]">{formatDate(l.startAt)} · {formatTime(l.startAt)}</p>
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

      <section id="yoklama-takvimi" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Yoklama Takvimi</h2>
        <AttendanceCalendarPanel
          studentId={studentId}
          termType={student.termType ?? "guz"}
          canEdit={session.role === "SCHOOL_ADMIN" || session.role === "SUPER_ADMIN"}
        />
      </section>

      <section id="telafi" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--color-text)]">
          Telafiler
          <Link href="/panel/telafi" className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
            Telafi Merkezinde Aç →
          </Link>
        </h2>
        {makeupRequests.length === 0 ? (
          <EmptyState title="Telafi kaydı yok" />
        ) : (
          <div className="space-y-2">
            {makeupRequests.map((m) => (
              <Card key={m.id} className="!p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{m.instrument} · {m.reason}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Son tarih: {formatDateTime(m.expiresAt)}</p>
                  </div>
                  <Badge status={m.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="odeme" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--color-text)]">
          Ödemeler ve Tahsilatlar
          <Link href={`/panel/odemeler/${student.id}`} className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
            Ödeme Detayında Aç →
          </Link>
        </h2>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Toplam tahakkuk" value={formatMoney(paymentSummary.totalBilled)} />
          <MiniStat label="Tahsil edilen" value={formatMoney(paymentSummary.totalCollected)} />
          <MiniStat label="Kalan" value={formatMoney(paymentSummary.remaining)} />
          <MiniStat label="Gecikmiş kalan" value={formatMoney(paymentSummary.overdueRemaining)} />
        </div>
        {payments.length === 0 ? (
          <EmptyState title="Ödeme kaydı yok" />
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 8).map((p) => (
              <Card key={p.id} className="!p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium text-[var(--color-text)]">{p.description}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Vade: {formatDate(p.dueDate)}</p>
                    {p.lessonId ? (
                      <a href="#program" className="text-xs font-medium text-[var(--color-primary)] hover:underline">
                        Kaynak ders →
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatMoney(p.amount - p.paidAmount)}</span>
                    <Badge status={p.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="gelisim" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Eğitim / Müzikal Gelişim</h2>
        <Card className="mb-3 !p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Müfredat ilerlemesi</p>
            <p className="text-lg font-semibold text-[var(--color-primary)]">%{curriculumOverall}</p>
          </div>
        </Card>
        {curriculumTopics.length > 0 ? (
          <div className="mb-3 space-y-2">
            {curriculumTopics.slice(0, 6).map((topic) => (
              <Card key={topic.id} className="!p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[var(--color-text)]">{topic.title}</p>
                  <Badge status={topic.status}>{topic.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
        {assessments.length === 0 ? (
          <EmptyState title="Henüz gelişim değerlendirmesi yok" />
        ) : (
          <div className="space-y-2">
            {assessments.slice(0, 5).map((a) => (
              <Link key={a.id} href={`/degerlendirme/${a.id}`}>
                <Card className="!p-3 transition hover:border-[var(--color-primary)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text)]">{formatDate(a.createdAt)}</p>
                    <p className="text-sm font-semibold text-[var(--color-primary)]">{computeOverallScore(a).toFixed(1)} / 5</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
        <Link href={`/degerlendirme/rapor/${student.id}`} className="mt-2 inline-block text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
          Tam raporu görüntüle →
        </Link>
      </section>

      <section id="odev" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ödevler ve Materyaller</h2>
        {homework.length === 0 ? (
          <EmptyState title="Ödev yok" />
        ) : (
          <div className="mb-3 space-y-2">
            {homework.slice(0, 5).map((hw) => (
              <Card key={hw.id} className="!p-3">
                <p className="text-sm font-medium text-[var(--color-text)]">{hw.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Son teslim: {formatDate(hw.dueDate)}</p>
              </Card>
            ))}
          </div>
        )}
        {materials.length > 0 ? (
          <div className="space-y-2">
            {materials.slice(0, 5).map((m) => (
              <Card key={m.id} className="!p-3">
                <p className="text-sm font-medium text-[var(--color-text)]">{m.title}</p>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      <section id="evrak" className="scroll-mt-4">
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--color-text)]">
          Evraklar
          <Link href={`/panel/evraklar?studentId=${student.id}`} className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
            Evraklar Merkezinde Aç →
          </Link>
        </h2>
        {documents.length === 0 ? (
          <EmptyState title="Bu öğrenciye bağlı evrak yok" description="Evraklar Merkezi'nden yeni bir belge oluşturabilirsiniz." />
        ) : (
          <div className="space-y-2">
            {documents.map((d) => (
              <Card key={d.id} className="!p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{d.reference}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(d.createdAt)}</p>
                  </div>
                  <Badge status={d.status}>{d.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, custom }: { label: string; value?: string; custom?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 font-medium text-[var(--color-text)]">{custom ?? value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-3 text-center">
      <p className="text-sm font-semibold text-[var(--color-text)]">{value}</p>
      <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
    </Card>
  );
}
