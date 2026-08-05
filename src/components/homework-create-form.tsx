"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";

export function HomeworkCreateForm({
  students,
  defaultStudentId,
  lockStudent = false,
}: {
  students: { id: string; name: string }[];
  /** Önceden seçili öğrenci (çalışma alanı gibi tek-öğrenci bağlamında). */
  defaultStudentId?: string;
  /** true ise öğrenci seçici gizlenir (yalnızca defaultStudentId kullanılır). */
  lockStudent?: boolean;
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(defaultStudentId ?? students[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId || !title.trim() || !description.trim() || !dueDate) {
      setError("Tüm alanlar zorunlu.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/v1/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          title: title.trim(),
          description: description.trim(),
          dueDate: new Date(dueDate).toISOString(),
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Ödev oluşturulamadı.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      setTitle("");
      setDescription("");
      setDueDate("");
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {lockStudent ? (
        <input type="hidden" name="studentId" value={studentId} />
      ) : (
        <div>
          <Label>Öğrenci</Label>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Label>Başlık</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gam çalışması" />
      </div>
      <div>
        <Label>Açıklama</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-500/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
      <div>
        <Label>Son teslim tarihi</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="text-xs font-medium text-emerald-600">Ödev oluşturuldu.</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Oluşturuluyor…" : "Ödev ver"}
      </Button>
    </form>
  );
}
