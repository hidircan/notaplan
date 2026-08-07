import { redirect } from "next/navigation";
import { actionAddStudent } from "@/lib/actions";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { StudentsTable, type StudentRow } from "@/components/students-table";
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
            <div>
              <Label>Ad soyad</Label>
              <Input name="name" required placeholder="Örn. Deniz Ak" />
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
              <Label>Veli adı</Label>
              <Input name="parentName" placeholder="Veli adı" />
            </div>
            <div>
              <Label>Veli telefon</Label>
              <Input name="parentPhone" placeholder="05xx xxx xxxx" />
            </div>
            <div>
              <Label>Enstrüman</Label>
              <Select name="instrument" defaultValue="Piyano">
                {["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"].map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
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
              <Label>Öğretmen</Label>
              <Select name="teacherId" defaultValue={data.teachers[0]?.id}>
                {data.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.instruments.join(", ")})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Paket</Label>
              <Input name="packageName" defaultValue="Bireysel Aylık — 4 ders" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Haftalık ders</Label>
                <Input name="weeklyLessonCount" type="number" defaultValue={1} min={1} />
              </div>
              <div>
                <Label>Aylık ücret</Label>
                <Input name="monthlyFee" type="number" defaultValue={3000} min={0} />
              </div>
            </div>
            <div>
              <Label>Not</Label>
              <Input name="notes" placeholder="Opsiyonel" />
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
              <Label>Yoklama Takvimi dönemi</Label>
              <Select name="termType" defaultValue="guz">
                <option value="guz">Güz Dönemi</option>
                <option value="yaz">Yaz Dönemi</option>
              </Select>
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
