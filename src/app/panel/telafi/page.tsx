import {
  actionCancelMakeup,
  actionConfirmSlot,
  actionGenerateSuggestions,
} from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime, formatTime } from "@/lib/utils";
import { CheckCircle2, Sparkles, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TelafiPage() {
  const data = await readData();
  const requests = [...data.makeupRequests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const open = requests.filter((r) => ["pending", "suggested"].includes(r.status));
  const done = requests.filter((r) => !["pending", "suggested"].includes(r.status));

  return (
    <div>
      <PageHeader
        title="Telafi Merkezi"
        description="Devamsızlık ve okul iptallerinden doğan telafi haklarını otomatik slot önerisiyle planlayın. Bu ürünün en güçlü satış noktası."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-800">Açık talep</p>
          <p className="mt-1 text-3xl font-semibold text-amber-950">{open.length}</p>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <p className="text-sm text-emerald-800">Onaylanan</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-950">
            {requests.filter((r) => r.status === "confirmed").length}
          </p>
        </Card>
        <Card className="bg-violet-50 border-violet-100">
          <p className="text-sm text-violet-800">Politika penceresi</p>
          <p className="mt-1 text-3xl font-semibold text-violet-950">
            {data.settings.makeupWindowDays} gün
          </p>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Aksiyon bekleyenler</h2>
      {open.length === 0 ? (
        <EmptyState
          title="Açık telafi talebi yok"
          description="Yoklama sayfasından devamsızlık işaretlediğinizde burada otomatik görünür."
        />
      ) : (
        <div className="space-y-4">
          {open.map((req) => {
            const student = data.students.find((s) => s.id === req.studentId);
            const teacher = data.teachers.find((t) => t.id === req.teacherId);
            return (
              <Card key={req.id} className="border-violet-100">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{student?.name}</h3>
                      <Badge status={req.status} />
                      <Badge status="makeup">{req.instrument}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Tercih öğretmen: <span className="font-medium">{teacher?.name}</span> ·{" "}
                      {data.settings.branches.find((b) => b.id === req.branchId)?.shortName} ·{" "}
                      {req.reason}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Oluşturulma: {formatDateTime(req.createdAt)} · Son kullanım:{" "}
                      {formatDateTime(req.expiresAt)}
                    </p>
                    <p className="mt-2 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {req.policyNote}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <form action={actionGenerateSuggestions}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <Button type="submit">
                        <Sparkles className="h-4 w-4" />
                        {req.suggestedSlots.length ? "Slotları yenile" : "Uygun slot öner"}
                      </Button>
                    </form>
                    <form action={actionCancelMakeup}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <Button type="submit" variant="ghost">
                        <X className="h-4 w-4" />
                        İptal
                      </Button>
                    </form>
                  </div>
                </div>

                {req.suggestedSlots.length > 0 ? (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="mb-3 text-sm font-medium text-slate-800">
                      Önerilen slotlar (skora göre sıralı)
                    </p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {req.suggestedSlots.map((slot, idx) => {
                        const slotTeacher = data.teachers.find((t) => t.id === slot.teacherId);
                        const room = data.rooms.find((r) => r.id === slot.roomId);
                        const branch = data.settings.branches.find((b) => b.id === slot.branchId);
                        return (
                          <div
                            key={`${slot.startAt}-${slot.teacherId}-${idx}`}
                            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {formatDateTime(slot.startAt)}
                                </p>
                                <p className="text-sm text-slate-600">
                                  {formatTime(slot.startAt)}–{formatTime(slot.endAt)} ·{" "}
                                  {slotTeacher?.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {branch?.shortName} · {room?.name}
                                </p>
                              </div>
                              <span className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                                Skor {slot.score}
                              </span>
                            </div>
                            <ul className="mt-2 space-y-0.5">
                              {slot.reasons.map((r) => (
                                <li key={r} className="text-[11px] text-slate-500">
                                  · {r}
                                </li>
                              ))}
                            </ul>
                            <form action={actionConfirmSlot} className="mt-3">
                              <input type="hidden" name="requestId" value={req.id} />
                              <input type="hidden" name="slot" value={JSON.stringify(slot)} />
                              <Button type="submit" variant="success" className="w-full">
                                <CheckCircle2 className="h-4 w-4" />
                                Bu slota onayla
                              </Button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Henüz slot önerilmedi. “Uygun slot öner” ile öğretmen müsaitliği, oda ve
                    çakışmaları tarayın.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {done.length > 0 ? (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-900">Geçmiş / tamamlanan</h2>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Öğrenci</th>
                  <th className="px-4 py-3">Enstrüman</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Onaylı ders</th>
                </tr>
              </thead>
              <tbody>
                {done.map((req) => {
                  const student = data.students.find((s) => s.id === req.studentId);
                  const lesson = data.lessons.find((l) => l.id === req.confirmedLessonId);
                  return (
                    <tr key={req.id} className="border-b border-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{student?.name}</td>
                      <td className="px-4 py-3 text-slate-600">{req.instrument}</td>
                      <td className="px-4 py-3">
                        <Badge status={req.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lesson ? formatDateTime(lesson.startAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
