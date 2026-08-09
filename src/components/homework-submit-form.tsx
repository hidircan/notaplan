"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** ~2MB ham dosya sınırı — submitHomeworkSchema (validation.ts) ile tutarlı. */
const MAX_FILE_BYTES = 2_000_000;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

export function HomeworkSubmitForm({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (file && file.size > MAX_FILE_BYTES) {
      setError("Dosya çok büyük (en fazla ~2MB).");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const fileData = file ? await readFileAsBase64(file) : undefined;
      const res = await fetch(`/api/v1/homework/${homeworkId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim() || undefined,
          fileName: file?.name,
          fileMimeType: file?.type,
          fileData,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Teslim yüklenemedi.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      setNote("");
      setFile(null);
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Not (opsiyonel)"
        rows={2}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)] outline-none ring-emerald-500/30 placeholder:text-[var(--color-text-muted)] focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <input
        type="file"
        accept="image/*,video/*,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-xs text-[var(--color-text-muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
      />
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="text-xs font-medium text-emerald-600">Teslim yüklendi.</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Yükleniyor…" : "Teslim et"}
      </Button>
    </form>
  );
}
