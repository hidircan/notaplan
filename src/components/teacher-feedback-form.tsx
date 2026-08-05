"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

const CRITERIA: { key: string; label: string }[] = [
  { key: "iletisim", label: "İletişim" },
  { key: "sabir", label: "Sabır" },
  { key: "alanBilgisi", label: "Alan bilgisi" },
  { key: "planlama", label: "Ders planlaması" },
];

export function TeacherFeedbackForm({ studentId }: { studentId: string }) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(CRITERIA.map((c) => [c.key, 3]))
  );
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/v1/teacher-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, scores, comment: comment.trim() || undefined }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Gönderilemedi.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      setComment("");
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
        Geri bildiriminiz için teşekkürler. Yalnızca okul yönetimi görüntüler.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {CRITERIA.map((c) => (
        <div key={c.key} className="flex items-center justify-between gap-2">
          <label className="text-sm text-slate-700 dark:text-slate-300">{c.label}</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScores((prev) => ({ ...prev, [c.key]: n }))}
                className={`h-7 w-7 rounded-full text-xs font-medium ${
                  scores[c.key] >= n
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Yorum (opsiyonel)"
        rows={3}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none ring-amber-500/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Gönderiliyor…" : "Gönder"}
      </Button>
    </form>
  );
}
