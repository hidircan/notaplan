"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui";

type TeacherOption = { id: string; name: string; branchId: string };
type RoomOption = { id: string; name: string; branchId: string };

export function ManualMakeupPlanForm({
  requestId,
  preferredTeacherId,
  sourceBranchId,
  lessonDurationMinutes,
  teachers,
  rooms,
}: {
  requestId: string;
  preferredTeacherId: string;
  sourceBranchId: string;
  lessonDurationMinutes: number;
  teachers: TeacherOption[];
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const initialTeacherId =
    teachers.find((t) => t.id === preferredTeacherId)?.id ??
    teachers.find((t) => t.branchId === sourceBranchId)?.id ??
    teachers[0]?.id ??
    "";
  const [teacherId, setTeacherId] = useState(initialTeacherId);
  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  const availableRooms = useMemo(
    () => rooms.filter((r) => r.branchId === selectedTeacher?.branchId),
    [rooms, selectedTeacher]
  );
  const [roomId, setRoomId] = useState(availableRooms[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function onTeacherChange(nextTeacherId: string) {
    setTeacherId(nextTeacherId);
    const nextTeacher = teachers.find((t) => t.id === nextTeacherId);
    const nextRooms = rooms.filter((r) => r.branchId === nextTeacher?.branchId);
    if (!nextRooms.some((r) => r.id === roomId)) {
      setRoomId(nextRooms[0]?.id ?? "");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !time || !teacherId || !roomId) {
      setError("Tarih, saat, öğretmen ve oda seçimi zorunlu.");
      return;
    }
    if (!decisionNote.trim()) {
      setError("Karar notu zorunludur.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const startAt = new Date(`${date}T${time}:00`);
      if (Number.isNaN(startAt.getTime())) {
        setError("Geçerli bir tarih ve saat seçin.");
        setBusy(false);
        return;
      }
      const endAt = new Date(startAt.getTime() + lessonDurationMinutes * 60000);
      const branchId = availableRooms.find((r) => r.id === roomId)?.branchId ?? sourceBranchId;
      const res = await fetch("/api/v1/makeup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          slot: {
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            teacherId,
            roomId,
            branchId,
            score: 0,
            reasons: ["Manuel planlama"],
          },
          decisionNote,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Telafi dersi planlanamadı.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <CalendarPlus className="h-4 w-4" /> Başka bir saat planla
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
    >
      <p className="mb-3 text-sm font-medium text-slate-800">Başka bir saat planla</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Başlangıç saati</label>
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Öğretmen</label>
          <select
            value={teacherId}
            onChange={(event) => onTeacherChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Oda</label>
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2"
          >
            {availableRooms.length === 0 ? (
              <option value="">Bu öğretmenin şubesinde uygun oda yok</option>
            ) : (
              availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Karar notu (zorunlu)
        </label>
        <textarea
          value={decisionNote}
          onChange={(event) => setDecisionNote(event.target.value)}
          required
          rows={2}
          placeholder="Bu saat neden seçildi?"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="submit" variant="success" disabled={busy || availableRooms.length === 0}>
          {busy ? "Planlanıyor..." : "Telafi dersini planla"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Vazgeç
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
      {success ? (
        <p className="mt-2 text-xs font-medium text-emerald-600">
          Telafi dersi programa eklendi.
        </p>
      ) : null}
    </form>
  );
}
