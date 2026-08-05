"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle } from "lucide-react";
import type { LiveDisplayStatus } from "@/lib/lesson-live-status";

/**
 * EPIC 8 — ders başlat / bitir.
 * Çift tıklama: in-flight istek varken ikinci çağrı yutulur (busy + ref).
 * Offline/queue yok: hata metni + tekrar dene yeterli.
 * Backend scheduled → in_progress → completed geçişlerini zorlar;
 * başlatılmamış ders bitirilemez.
 */
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
  const inFlight = useRef(false);

  async function onAction(action: "start" | "end") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/lessons/${lessonId}/${action}`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "İşlem başarısız. Tekrar deneyin.");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (displayStatus === "completed" || displayStatus === "cancelled" || displayStatus === "no_show") {
    return null;
  }

  const isStart = displayStatus !== "in_progress";
  const label = busy
    ? isStart
      ? "Başlatılıyor…"
      : "Bitiriliyor…"
    : isStart
      ? "Dersi başlat"
      : "Dersi bitir";

  return (
    <div className="mt-1.5">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        aria-label={label}
        onClick={() => void onAction(isStart ? "start" : "end")}
        className={
          isStart
            ? "inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
            : "inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        }
      >
        {isStart ? <PlayCircle className="h-3 w-3" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
        {label}
      </button>
      {error ? (
        <p className="mt-1 text-[10px] font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
