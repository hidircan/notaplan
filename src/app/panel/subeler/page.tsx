import { actionAddBranch, actionUpdateBranch } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SubelerPage() {
  const data = await readData();
  const branches = [...data.settings.branches].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return (
    <div>
      <PageHeader
        title="Şubeler"
        description="Okulunuzun tüm fiziksel şubeleri. Şube silme desteklenmez — yanlış girilen bilgiyi düzenleyebilirsiniz."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {branches.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">Henüz şube eklenmedi.</p>
            </Card>
          ) : (
            branches.map((b) => {
              const teacherCount = data.teachers.filter((t) => t.branchId === b.id && t.active).length;
              const studentCount = data.students.filter((s) => s.branchId === b.id && s.active).length;
              const roomCount = data.rooms.filter((r) => r.branchId === b.id).length;
              return (
                <Card key={b.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{b.name}</h3>
                      <p className="text-sm text-slate-500">
                        {b.shortName} · {b.city}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {b.address} · {b.phone}
                      </p>
                    </div>
                    <div className="flex gap-2 text-center text-xs text-slate-500">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{teacherCount}</p>
                        Öğretmen
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{studentCount}</p>
                        Öğrenci
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{roomCount}</p>
                        Oda
                      </div>
                    </div>
                  </div>

                  <details className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-600">
                      Düzenle
                    </summary>
                    <form action={actionUpdateBranch} className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="branchId" value={b.id} />
                      <div>
                        <Label>Ad</Label>
                        <Input name="name" defaultValue={b.name} required />
                      </div>
                      <div>
                        <Label>Kısa ad</Label>
                        <Input name="shortName" defaultValue={b.shortName} required />
                      </div>
                      <div>
                        <Label>Şehir</Label>
                        <Input name="city" defaultValue={b.city} required />
                      </div>
                      <div>
                        <Label>Telefon</Label>
                        <Input name="phone" defaultValue={b.phone} required />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Adres</Label>
                        <Input name="address" defaultValue={b.address} required />
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" variant="secondary">
                          Kaydet
                        </Button>
                      </div>
                    </form>
                  </details>
                </Card>
              );
            })
          )}
        </div>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Yeni şube</h2>
          <form action={actionAddBranch} className="space-y-3">
            <div>
              <Label>Ad</Label>
              <Input name="name" required placeholder="Örn. Bostanlı Şubesi" />
            </div>
            <div>
              <Label>Kısa ad</Label>
              <Input name="shortName" required placeholder="Örn. Bostanlı" />
            </div>
            <div>
              <Label>Şehir</Label>
              <Input name="city" required placeholder="Örn. İzmir" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input name="phone" required placeholder="05xx xxx xxxx" />
            </div>
            <div>
              <Label>Adres</Label>
              <Input name="address" required placeholder="Açık adres" />
            </div>
            <Button type="submit" className="w-full">
              Şube ekle
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
