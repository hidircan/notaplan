import { actionAddStudent } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OgrencilerPage() {
  const data = await readData();
  const students = [...data.students].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return (
    <div>
      <PageHeader
        title="Öğrenciler"
        description="Kayıtlar, paketler, veli bilgisi ve atanan öğretmenler."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Öğrenci</th>
                <th className="px-4 py-3">Enstrüman</th>
                <th className="px-4 py-3">Öğretmen</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Ücret</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const teacher = data.teachers.find((t) => t.id === s.teacherId);
                return (
                  <tr key={s.id} className="border-b border-slate-50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        Veli: {s.parentName} · {s.parentPhone} ·{" "}
                        {data.settings.branches.find((b) => b.id === s.branchId)?.shortName}
                      </p>
                      {s.notes ? <p className="mt-1 text-xs text-violet-600">{s.notes}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      {s.instruments.map((i) => (
                        <Badge key={i}>{i}</Badge>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{teacher?.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{s.packageName}</p>
                      <p className="text-xs text-slate-400">{s.weeklyLessonCount} ders/hafta</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatMoney(s.monthlyFee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

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
