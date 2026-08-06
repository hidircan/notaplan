import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, Circle, Download, RefreshCcw, Upload } from "lucide-react";
import { actionResetDemo } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { computeSetupProgress, type SetupStepId } from "@/lib/setup-progress";
import { EXPORT_ENTITIES, type ExportEntity } from "@/lib/export/institution-export";
import { DEFAULT_COLLECTIONS_SETTINGS } from "@/lib/types";
import { CollectionsSettingsForm } from "@/components/collections-settings-form";

const EXPORT_LABELS: Record<ExportEntity, string> = {
  students: "Öğrenciler",
  teachers: "Öğretmenler",
  lessons: "Dersler",
  attendances: "Yoklamalar",
  payments: "Ödemeler",
  makeupRequests: "Telafi talepleri",
  notifications: "Bildirimler",
  announcements: "Duyurular",
  lessonAssessments: "Gelişim değerlendirmeleri",
  teacherAvailabilityRequests: "Müsaitlik önerileri",
  homework: "Ödevler",
  homeworkSubmissions: "Ödev teslimleri",
  teachingMaterials: "Materyaller",
  teacherFeedback: "Öğretmen geri bildirimleri",
  studentCurriculumTopics: "Müfredat konuları",
};

export const dynamic = "force-dynamic";

const STEP_LINKS: Record<SetupStepId, { href: string; doneLabel: string; missingLabel: string }> = {
  school: {
    href: "/panel/subeler",
    doneLabel: "Şubeleri yönet",
    missingLabel: "Şube ekle",
  },
  teachers: {
    href: "/panel/ogretmenler",
    doneLabel: "Öğretmenleri yönet",
    missingLabel: "Öğretmen ekle",
  },
  rooms: {
    href: "/panel/odalar",
    doneLabel: "Odaları yönet",
    missingLabel: "Oda ekle",
  },
  students: {
    href: "/panel/ogrenciler",
    doneLabel: "Öğrencileri yönet",
    missingLabel: "Öğrenci ekle",
  },
  firstLesson: {
    href: "/panel/program",
    doneLabel: "Programı görüntüle",
    missingLabel: "Ders planla",
  },
};

export default async function KurulumPage() {
  const data = await readData();
  const progress = computeSetupProgress(data);

  return (
    <div>
      <PageHeader
        title="Kurulum Merkezi"
        description="Okulunuzu günlük operasyona hazırlamak için temel adımları tamamlayın."
      />

      <Card
        className={
          progress.isReady
            ? "mb-6 border-emerald-200 bg-emerald-50/60"
            : "mb-6 border-amber-200 bg-amber-50/60"
        }
      >
        <p
          className={
            progress.isReady
              ? "text-sm font-semibold text-emerald-800"
              : "text-sm font-semibold text-amber-800"
          }
        >
          {progress.isReady
            ? "Temel kurulum tamamlandı"
            : `${progress.completedCount}/${progress.totalCount} temel adım tamamlandı`}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {progress.isReady
            ? "Okulunuz günlük operasyona hazır. İhtiyaç halinde aşağıdaki ekranlardan yeni kayıt ekleyebilirsiniz."
            : "Aşağıdaki eksik adımları tamamlayarak okulunuzu operasyona hazır hale getirin."}
        </p>
      </Card>

      <Link
        href="/panel/veri-aktar"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
      >
        <Upload className="h-4 w-4" /> Verilerinizi topluca aktarın (CSV)
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {progress.steps.map((step) => {
          const link = STEP_LINKS[step.id];
          return (
            <Card key={step.id} className={step.done ? "border-emerald-100" : "border-amber-100"}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {step.done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{step.label}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{step.description}</p>
                  </div>
                </div>
                <Badge status={step.done ? "paid" : "pending"}>
                  {step.done ? "Tamamlandı" : "Eksik"}
                </Badge>
              </div>
              <Link
                href={link.href}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                {step.done ? link.doneLabel : link.missingLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          );
        })}

        <Card className={progress.hasPayment ? "border-emerald-100" : "border-slate-200"}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {progress.hasPayment ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              )}
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-50">İlk ödeme (isteğe bağlı)</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tahsilat takibini başlatmak için ilk ödeme kaydını ekleyin. Kurulumun
                  tamamlanması için zorunlu değildir.
                </p>
              </div>
            </div>
            <Badge status={progress.hasPayment ? "paid" : "pending"}>
              {progress.hasPayment ? "Eklendi" : "İsteğe bağlı"}
            </Badge>
          </div>
          <Link
            href="/panel/odemeler"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            İlk tahsilatı ekle <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>

      <Card className="mt-6 border-slate-200">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-50">Veri &amp; Güvenlik</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Yalnızca oturum açtığınız kuruma ait kayıtları CSV olarak indirin. Diğer
              kurumların hiçbir kaydı bu dışa aktarıma dahil edilmez. &quot;Tüm kurumlar&quot;
              görünümündeyken dışa aktarım yapılamaz — önce tek bir kurum seçin.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXPORT_ENTITIES.map((entity) => (
                <a
                  key={entity}
                  href={`/api/v1/export?entity=${entity}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" /> {EXPORT_LABELS[entity]} (CSV)
                </a>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-6 border-slate-200">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-50">Tahsilat Otomasyonu</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gecikmiş ödemeler için taslak mesaj ve veli bildirimi ne sıklıkla hazırlansın?
              Veliler kendi iletişim tercihlerini veli portalından değiştirebilir.
            </p>
            <CollectionsSettingsForm
              frequencyLimitDays={
                data.settings.collectionsSettings?.frequencyLimitDays ??
                DEFAULT_COLLECTIONS_SETTINGS.frequencyLimitDays
              }
              autoSendEnabled={
                data.settings.collectionsSettings?.autoSendEnabled ??
                DEFAULT_COLLECTIONS_SETTINGS.autoSendEnabled
              }
              telafiChargesOnFlag={
                data.settings.collectionsSettings?.telafiChargesOnFlag ??
                DEFAULT_COLLECTIONS_SETTINGS.telafiChargesOnFlag ??
                false
              }
            />
          </div>
        </div>
      </Card>

      <Card className="mt-6 border-slate-200 bg-slate-50">
        <div className="flex items-start gap-3">
          <RefreshCcw className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-50">Demo ortamı</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Demo verisini sıfırlamak mevcut demo değişikliklerini geri alır. Bu işlem yalnızca
              yönetici yetkisiyle yapılabilir.
            </p>
            <form action={actionResetDemo} className="mt-3">
              <Button type="submit" variant="secondary">
                Demo verisini geri yükle
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
