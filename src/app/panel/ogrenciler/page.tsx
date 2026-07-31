import { actionAddStudent } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { StudentsTable, type StudentRow } from "@/components/students-table";

export const dynamic = "force-dynamic";

export default async function OgrencilerPage() {
  const data = await readData();
  const students = [...data.students].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    parentName: s.parentName,
    parentPhone: s.parentPhone,
    branchName: data.settings.branches.find((b) => b.id === s.branchId)?.shortName,
    notes: s.notes,
    instruments: s.instruments,
    teacherName: data.teachers.find((t) => t.id === s.teacherId)?.name,
    packageName: s.packageName,
    weeklyLessonCount: s.weeklyLessonCount,
    monthlyFee: s.monthlyFee,
    active: s.active,
  }));

  return (
    <div>
      <PageHeader
        title="Öğrenciler"
        description="Kayıtlar, paketler, veli bilgisi ve atanan öğretmenler."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StudentsTable rows={rows} />
        </div>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Yeni öğrenci</h2>
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
              <Select name="branchId" defaultValue="erzene">
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
            <Button type="submit" className="w-full">
              Öğrenci ekle
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
