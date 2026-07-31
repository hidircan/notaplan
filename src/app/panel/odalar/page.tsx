import { actionAddRoom } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { INSTRUMENTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OdalarPage() {
  const data = await readData();
  const rooms = [...data.rooms].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return (
    <div>
      <PageHeader
        title="Odalar"
        description="Stüdyoların şube ve enstrüman uyumu; telafi ve ders planlamasında kullanılır."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Oda</th>
                <th className="px-4 py-3">Şube</th>
                <th className="px-4 py-3">Kapasite</th>
                <th className="px-4 py-3">Enstrümanlar</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    Henüz oda eklenmedi.
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.id} className="border-b border-slate-50 align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{room.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {data.settings.branches.find((b) => b.id === room.branchId)?.shortName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{room.capacity}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {room.instruments.map((i) => (
                          <Badge key={i}>{i}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Yeni oda</h2>
          <form action={actionAddRoom} className="space-y-3">
            <div>
              <Label>Ad</Label>
              <Input name="name" required placeholder="Örn. Stüdyo 3" />
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
              <Label>Kapasite</Label>
              <Input name="capacity" type="number" defaultValue={2} min={1} />
            </div>
            <div>
              <Label>Desteklenen enstrümanlar</Label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3">
                {INSTRUMENTS.map((instrument) => (
                  <label key={instrument} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="instruments" value={instrument} />
                    {instrument}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">
              Oda ekle
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
