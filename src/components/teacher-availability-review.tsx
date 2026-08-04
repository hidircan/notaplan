"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { dayName } from "@/lib/utils";
import type { AvailabilityWindow, TeacherAvailabilityRequest } from "@/lib/types";

function windowsSummary(windows: AvailabilityWindow[]): string {
  if (windows.length === 0) return "Müsaitlik yok";
  return windows
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((w) => `${dayName(w.dayOfWeek)} ${w.start}–${w.end}`)
    .join(", ");
}

export function TeacherAvailabilityReview({
  request,
  currentAvailability,
}: {
  request: TeacherAvailabilityRequest;
  currentAvailability: AvailabilityWindow[];
}) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDecision(decision: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/teachers/availability-requests/${request.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNote: reviewNote.trim() || undefined }),
      });
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

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Mevcut müsaitlik</p>
      <p className="text-sm text-slate-700 dark:text-slate-300">{windowsSummary(currentAvailability)}</p>
      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Önerilen müsaitlik</p>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
        {windowsSummary(request.proposedAvailability)}
      </p>

      <textarea
        value={reviewNote}
        onChange={(e) => setReviewNote(e.target.value)}
        placeholder="İnceleme notu (opsiyonel)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none ring-violet-500/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}

      <div className="mt-2 flex gap-2">
        <Button variant="success" disabled={busy} onClick={() => onDecision("approved")}>
          Onayla
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => onDecision("rejected")}>
          Reddet
        </Button>
      </div>
    </div>
  );
}
