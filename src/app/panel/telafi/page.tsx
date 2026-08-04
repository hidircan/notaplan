import {
  actionCancelMakeup,
  actionConfirmSlot,
  actionGenerateSuggestions,
} from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { TelafiSubmitButton } from "@/components/telafi-submit-button";
import { MakeupDecisionForm } from "@/components/makeup-decision-form";
import { ManualMakeupPlanForm } from "@/components/manual-makeup-plan-form";
import { formatDateTime, formatTime } from "@/lib/utils";
import { CheckCircle2, Download, Sparkles, X } from "lucide-react";

const MORE_SUGGESTIONS_COUNT = 18;

export const dynamic = "force-dynamic";

export default async function TelafiPage() {
  const data = await readData();
  const requests = [...data.makeupRequests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const OPEN_STATUSES = ["pending", "suggested", "awaiting_info"];
  const open = requests.filter((r) => OPEN_STATUSES.includes(r.status));
  const done = requests.filter((r) => !OPEN_STATUSES.includes(r.status));

  return (
    <div>
      <PageHeader
        title="Telafi Merkezi"
        description="Açık telafi taleplerini listeleyin, şube / öğretmen / oda çakışmalarını tarayın ve en iyi slotu onaylayarak dersi programa alın."
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
          description="Gelmedi veya okul iptalini işaretlediğiniz dersler buraya gelir; ardından uygun slot önerisi yapabilirsiniz."
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
                      <TelafiSubmitButton pendingLabel="Aranıyor...">
                        <Sparkles className="h-4 w-4" />
                        {req.suggestedSlots.length ? "Saatleri yenile" : "En uygun saatleri bul"}
                      </TelafiSubmitButton>
                    </form>
                    <MakeupDecisionForm
                      action={actionCancelMakeup}
                      hiddenFields={{ requestId: req.id }}
                      pendingLabel="İptal ediliyor..."
                      variant="ghost"
                      placeholder="İptal/ret gerekçesi (zorunlu)…"
                    >
                      <X className="h-4 w-4" />
                      İptal / reddet
                    </MakeupDecisionForm>
                  </div>
                </div>

                {req.suggestedSlots.length > 0 ? (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-sm font-medium text-slate-800">
                      Önerilen slotlar (skora göre sıralı)
                    </p>
                    <p className="mb-3 mt-1 text-xs text-slate-500">
                      Bunlar en yüksek puanlı uygun seçeneklerdir; başka bir saat da
                      planlayabilirsiniz.
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
                            <div className="mt-3">
                              <MakeupDecisionForm
                                action={actionConfirmSlot}
                                hiddenFields={{ requestId: req.id, slot: JSON.stringify(slot) }}
                                pendingLabel="Onaylanıyor..."
                                variant="success"
                                placeholder="Onay notu (zorunlu)…"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Bu slota onayla
                              </MakeupDecisionForm>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <form action={actionGenerateSuggestions} className="mt-3">
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="maxSlots" value={MORE_SUGGESTIONS_COUNT} />
                      <TelafiSubmitButton variant="secondary" pendingLabel="Aranıyor...">
                        Daha fazla uygun saat göster
                      </TelafiSubmitButton>
                    </form>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Henüz saat önerilmedi. “En uygun saatleri bul” ile öğretmen müsaitliği, oda ve
                    çakışmaları tarayın.
                  </p>
                )}

                {(() => {
                  const teachers = data.teachers
                    .filter((t) => t.active && t.instruments.includes(req.instrument))
                    .map((t) => ({ id: t.id, name: t.name, branchId: t.branchId }));
                  const rooms = data.rooms
                    .filter((r) => r.instruments.includes(req.instrument))
                    .map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }));
                  if (!student || teachers.length === 0 || rooms.length === 0) return null;
                  return (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <ManualMakeupPlanForm
                        requestId={req.id}
                        preferredTeacherId={req.teacherId}
                        sourceBranchId={req.branchId}
                        lessonDurationMinutes={data.settings.lessonDurationMinutes}
                        teachers={teachers}
                        rooms={rooms}
                      />
                    </div>
                  );
                })()}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mb-3 mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Geçmiş / tamamlanan</h2>
        <a
          href="/api/v1/export?entity=makeupRequests"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> Tüm talepleri CSV indir
        </a>
      </div>
      {done.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Öğrenci</th>
                  <th className="px-4 py-3">Enstrüman</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Onaylı ders</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Karar notu</th>
                  <th className="px-4 py-3">Karar tarihi</th>
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
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {req.slaDeadline ? formatDateTime(req.slaDeadline) : "—"}
                        {(req.slaEscalationLevel ?? 0) >= 5 ? (
                          <span className="ml-1 font-semibold text-rose-600">Aşıldı</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {req.decisionNote ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {req.decidedAt ? formatDateTime(req.decidedAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
      ) : null}
    </div>
  );
}
