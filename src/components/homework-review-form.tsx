"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function HomeworkReviewForm({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!feedback.trim()) {
      setError("Geri bildirim boş olamaz.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/homework-submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherFeedback: feedback.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Gönderilemedi.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-1 flex items-center gap-2">
      <input
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Geri bildirim yaz…"
        className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none ring-cyan-500/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <Button type="submit" disabled={busy} className="!px-2.5 !py-1 !text-xs">
        Gönder
      </Button>
      {error ? <span className="text-[10px] font-medium text-rose-600">{error}</span> : null}
    </form>
  );
}
