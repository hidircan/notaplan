"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle } from "lucide-react";
import type { LiveDisplayStatus } from "@/lib/lesson-live-status";

export function LessonLiveActions({
  lessonId,
  displayStatus,
}: {
  lessonId: string;
  displayStatus: LiveDisplayStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAction(action: "start" | "end") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/lessons/${lessonId}/${action}`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "İşlem başarısız.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
      setBusy(false);
    }
  }

  if (displayStatus === "completed" || displayStatus === "cancelled" || displayStatus === "no_show") {
    return null;
  }

  return (
    <div className="mt-1.5">
      {displayStatus === "in_progress" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAction("end")}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3 w-3" /> Dersi bitir
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAction("start")}
          className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          <PlayCircle className="h-3 w-3" /> Dersi başlat
        </button>
      )}
      {error ? <p className="mt-1 text-[10px] font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
