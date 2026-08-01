import { actionAddTeacher } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { dayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OgretmenlerPage() {
  const data = await readData();

  return (
    <div>
      <PageHeader
        title="Öğretmenler"
        description="Müsaitlik pencereleri telafi motoru tarafından kullanılır."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {data.teachers.map((t) => {
            const studentCount = data.students.filter((s) => s.teacherId === t.id && s.active).length;
            const weekLessons = data.lessons.filter((l) => l.teacherId === t.id && l.status !== "cancelled").length;
            return (
              <Card key={t.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm"
                      style={{ background: t.color }}
                    >
                      {t.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{t.name}</h3>
                      <p className="text-sm text-slate-500">
                        {data.settings.branches.find((b) => b.id === t.branchId)?.shortName} ·{" "}
                        {t.email} · {t.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.instruments.map((i) => (
                      <Badge key={i}>{i}</Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Öğrenci</p>
                    <p className="text-lg font-semibold">{studentCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Kayıtlı ders</p>
                    <p className="text-lg font-semibold">{weekLessons}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Günlük limit</p>
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
                        className="rounded-lg bg-violet-50 px-2 py-1 text-xs text-violet-800"
                      >
                        {dayName(a.dayOfWeek)} {a.start}–{a.end}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Yeni öğretmen</h2>
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
              <Label>Ana enstrüman</Label>
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
            <p className="text-xs text-slate-500">
              Varsayılan müsaitlik: Pzt–Cum 10:00–18:00 (sonra düzenlenebilir).
            </p>
            <Button type="submit" className="w-full">
              Öğretmen ekle
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
