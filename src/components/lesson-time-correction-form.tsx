"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

/**
 * EPIC 8 admin time correction — note zorunlu; existing correctLessonTimesTool.
 */
export function LessonTimeCorrectionForm({
  lessons,
}: {
  lessons: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [actualStartAt, setActualStartAt] = useState("");
  const [actualEndAt, setActualEndAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!lessonId) {
      setError("Ders seçin.");
      return;
    }
    if (!note.trim()) {
      setError("Düzeltme notu zorunludur.");
      return;
    }
    if (!actualStartAt && !actualEndAt) {
      setError("En az bir gerçek başlangıç veya bitiş zamanı girin.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const body: Record<string, string> = { note: note.trim() };
      if (actualStartAt) body.actualStartAt = new Date(actualStartAt).toISOString();
      if (actualEndAt) body.actualEndAt = new Date(actualEndAt).toISOString();
      const res = await fetch(`/api/v1/lessons/${lessonId}/correct`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Düzeltme başarısız.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      setNote("");
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (lessons.length === 0) {
    return <p className="text-sm text-slate-500">Düzeltilecek ders bulunamadı.</p>;
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <div>
        <Label>Ders</Label>
        <select
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Gerçek başlangıç</Label>
          <Input
            type="datetime-local"
            value={actualStartAt}
            onChange={(e) => setActualStartAt(e.target.value)}
          />
        </div>
        <div>
          <Label>Gerçek bitiş</Label>
          <Input
            type="datetime-local"
            value={actualEndAt}
            onChange={(e) => setActualEndAt(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>Düzeltme notu (zorunlu)</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          required
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Örn. Saat kayması — öğretmen bildirimi"
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className="text-xs font-medium text-emerald-600">Düzeltme kaydedildi.</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Kaydediliyor…" : "Zamanı düzelt"}
      </Button>
    </form>
  );
}
