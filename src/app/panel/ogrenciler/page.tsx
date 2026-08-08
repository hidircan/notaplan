import { redirect } from "next/navigation";
import { actionAddStudent } from "@/lib/actions";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { StudentsTable, type StudentRow } from "@/components/students-table";
import { StudentInstrumentTeacherFields } from "@/components/student-instrument-teacher-fields";
import { StudentPackagePricingFields } from "@/components/student-package-pricing-fields";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { computeAllStudentAttendanceRisks } from "@/lib/insights/attendance-risk";
import { STUDENT_TYPES } from "@/lib/types";
import { AiInsightTrigger } from "@/components/ai/ai-insight-trigger";
import { AssistantPageContext } from "@/components/ai/assistant-page-context";

export const dynamic = "force-dynamic";

export default async function OgrencilerPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/ogrenciler");
  }
  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);
  const students = [...data.students].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const risks = computeAllStudentAttendanceRisks(data);
  const atRisk = risks
    .filter((r) => r.riskLevel !== "low")
    .map((r) => ({ ...r, student: data.students.find((s) => s.id === r.studentId) }))
    .filter((r) => r.student)
    .sort((a, b) => (a.riskLevel === b.riskLevel ? 0 : a.riskLevel === "high" ? -1 : 1));

  const rows: StudentRow[] = students.map((s) => {
    const studentPayments = data.payments.filter((p) => p.studentId === s.id);
    const paymentStatus: StudentRow["paymentStatus"] =
      studentPayments.length === 0
        ? "none"
        : studentPayments.some((p) => p.status === "overdue")
          ? "overdue"
          : studentPayments.some((p) => p.status === "partial")
            ? "partial"
            : studentPayments.every((p) => p.status === "paid")
              ? "paid"
              : "pending";
    return {
      id: s.id,
      name: s.name,
      branchName: data.settings.branches.find((b) => b.id === s.branchId)?.shortName,
      instruments: s.instruments,
      teacherName: data.teachers.find((t) => t.id === s.teacherId)?.name,
      packageName: s.packageName,
      monthlyFee: s.monthlyFee,
      active: s.active,
      studentType: s.studentType,
      enrollmentStartDate: s.enrollmentStartDate,
      enrollmentEndDate: s.enrollmentEndDate,
      level: s.level,
      targetExam: s.targetExam,
      educationMethod: s.educationMethod,
      paymentStatus,
    };
  });

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <AssistantPageContext entity={{ kind: "page", label: "Öğrenciler" }} />
      <PageHeader
        title="Öğrenciler"
        description="Kayıtlar, paketler, veli bilgisi ve atanan öğretmenler."
      />

      {atRisk.length > 0 ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/40">
          <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            Devamsızlık riski ({atRisk.length} öğrenci)
          </p>
          <ul className="mb-3 space-y-1 text-sm">
            {atRisk.slice(0, 8).map((r) => (
              <li key={r.studentId} className="flex items-center justify-between gap-2">
                <span className="text-slate-700 dark:text-slate-300">{r.student?.name}</span>
                <span
                  className={
                    r.riskLevel === "high"
                      ? "text-xs font-semibold text-rose-700"
                      : "text-xs font-semibold text-amber-700"
                  }
                >
                  {r.riskLevel === "high" ? "Yüksek risk" : "Orta risk"} · {r.absentCount} gelmedi
                  {r.consecutiveAbsences >= 2 ? ` · ${r.consecutiveAbsences} art arda` : ""}
                </span>
              </li>
            ))}
          </ul>
          <AiInsightTrigger
            capabilityId="attendanceRiskAssessment"
            label="AI ile yorumla"
            payload={{
              atRiskCount: atRisk.length,
              highRiskCount: atRisk.filter((r) => r.riskLevel === "high").length,
              topCases: atRisk.slice(0, 5).map((r) => ({
                studentName: r.student?.name,
                riskLevel: r.riskLevel,
                absentCount: r.absentCount,
                consecutiveAbsences: r.consecutiveAbsences,
              })),
            }}
          />
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StudentsTable rows={rows} />
        </div>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-50">Yeni öğrenci</h2>
          {kurum.scope.mode !== "single" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              &quot;Tüm kurumlar&quot; görünümündesiniz — yeni öğrenci eklemek için üstteki kurum
              seçiciden tek bir kurum seçin.
            </p>
          ) : (
          <form action={actionAddStudent} className="space-y-3">
            {/*
              Alan sırası bilinçli olarak şu şekilde: 1) öğrenci adı 2) T.C.
              kimlik (ikinci ana alan — kayıt sırasında en sık birlikte
              istenen resmi kimlik bilgisi) 3-4) veli adı/telefonu 5) hemen
              ardından doğum tarihi/yeri, okul/meslek, ev adresi — sonra
              mevcut akış (öğrenci iletişim, şube/enstrüman/öğretmen/paket/
              ders süresi/dönem/izin) aynı göreli sırayla devam eder. Veri
              modeli/validation (actionAddStudent, createStudentSchema)
              DEĞİŞMEDİ — yalnızca bu form bloğundaki DOM/JSX sırası.
            */}
            <div>
              <Label>Ad soyad</Label>
              <Input name="name" required placeholder="Örn. Deniz Ak" />
            </div>
            <div>
              {/* T.C. kimlik — şifreli saklanır (setNationalIdTool), listede/exportta asla düz metin görünmez. */}
              <Label>T.C. kimlik no (opsiyonel — şifreli saklanır)</Label>
              <Input name="nationalId" inputMode="numeric" maxLength={11} placeholder="11 haneli" />
            </div>
            <div>
              <Label>Veli adı</Label>
              <Input name="parentName" placeholder="Veli adı" />
            </div>
            <div>
              <Label>Veli telefon</Label>
              <Input name="parentPhone" placeholder="05xx xxx xxxx" />
            </div>
            <div>
              <Label>Doğum tarihi (opsiyonel)</Label>
              <Input name="birthDate" type="date" />
            </div>
            <div>
              <Label>Doğum yeri (opsiyonel)</Label>
              <Input name="birthPlace" placeholder="Örn. İzmir" />
            </div>
            <div>
              <Label>Okulu / mesleği (opsiyonel)</Label>
              <Input name="schoolOrOccupation" placeholder="Örn. Erzene İlkokulu 3-A" />
            </div>
            <div>
              <Label>Ev adresi (opsiyonel)</Label>
              <Input name="address" placeholder="Opsiyonel" />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input name="email" type="email" placeholder="ogrenci@email.com" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input name="phone" placeholder="05xx xxx xxxx" />
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
            {/*
              MT-003 — enstrüman seçimine göre öğretmen listesi anlık
              filtrelenir (yalnız o enstrümanı öğretebilen AKTİF öğretmenler).
              Sunucu tarafı doğrulama (aktif+tenant+enstrüman uyumu)
              createStudentTool'da AYRICA yapılır — bu yalnız UX.
            */}
            <StudentInstrumentTeacherFields
              instrumentOptions={["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"]}
              teachers={data.teachers.map((t) => ({
                id: t.id,
                name: t.name,
                active: t.active,
                instruments: t.instruments,
              }))}
            />
            <div>
              <Label>Paket (serbest metin — geçmişle uyum için)</Label>
              <Input name="packageName" defaultValue="Bireysel Aylık — 4 ders" />
            </div>
            <div>
              <Label>Haftalık ders</Label>
              <Input name="weeklyLessonCount" type="number" defaultValue={1} min={1} />
            </div>
            {/* Package C — paket + süre + indirim + canlı nihai ücret önizlemesi.
                Paket seçilmezse eski serbest "Aylık ücret" alanı (legacy) kullanılır —
                iki çelişkili fiyat alanı asla aynı anda görünmez. */}
            <StudentPackagePricingFields
              packages={(data.packages ?? [])
                .filter((p) => p.status === "active")
                .map((p) => ({
                  id: p.id,
                  title: p.title,
                  price30Min: p.price30Min,
                  price40Min: p.price40Min,
                  price50Min: p.price50Min,
                }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Ödeme türü (opsiyonel)</Label>
                <Select name="paymentMethod" defaultValue="">
                  <option value="">Belirtilmemiş</option>
                  <option value="cash">Nakit</option>
                  <option value="transfer">Havale</option>
                  <option value="credit_card">Kredi Kartı</option>
                </Select>
              </div>
              <div>
                <Label>Ödeme günü (1–31, opsiyonel)</Label>
                <Input name="paymentDueDay" type="number" min={1} max={31} />
              </div>
            </div>
            <div>
              <Label>Yoklama Takvimi dönemi</Label>
              <Select name="termType" defaultValue="guz">
                <option value="guz">Güz Dönemi</option>
                <option value="yaz">Yaz Dönemi</option>
              </Select>
            </div>
            <div>
              <Label>Öğrenci türü (opsiyonel)</Label>
              <Select name="studentType" defaultValue="">
                <option value="">Belirtilmemiş</option>
                {STUDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Kayıt başlangıç tarihi (opsiyonel)</Label>
              <Input name="enrollmentStartDate" type="date" />
            </div>
            <div>
              <Label>Seviye (opsiyonel)</Label>
              <Input name="level" placeholder="Örn. Başlangıç, Orta, İleri" />
            </div>
            <div>
              <Label>Hedef sınav / performans dönemi (opsiyonel)</Label>
              <Input name="targetExam" placeholder="Örn. 2027 Konservatuvar giriş sınavı" />
            </div>
            <div>
              <Label>Not</Label>
              <Input name="notes" placeholder="Opsiyonel" />
            </div>
            <div className="flex items-center gap-2">
              <input id="social-media-consent" type="checkbox" name="socialMediaConsent" value="granted" className="h-4 w-4" />
              <label htmlFor="social-media-consent" className="text-sm text-[var(--color-text)]">
                Sosyal medya paylaşım izni var
              </label>
            </div>
            <Button type="submit" className="w-full">
              Öğrenci ekle
            </Button>
          </form>
          )}
        </Card>
      </div>
    </div>
  );
}
