"use client";

/**
 * `collectionsIntake` — owned by the Tahsilat screen (same domain as
 * `collectionsMessageDraft`/`collectionsROIReport`, already here). This is a
 * PROPOSAL surface only: `executeWithProvider` narrates a prioritization,
 * it does NOT write a `FollowUpCase` row itself — the real case-opening
 * action stays the existing, untouched "Takip başlat" button in the queue
 * below. The copy here says so explicitly so nobody mistakes a narrated
 * suggestion for an actually-opened case.
 */
import { Sparkles } from "lucide-react";
import { useCollectionsAI } from "@/hooks/useCollectionsAI";

export function CollectionsIntakeScan({
  tenantId,
  payload,
}: {
  tenantId: string;
  payload: Record<string, unknown>;
}) {
  const { intakeText, isIntakeLoading, intakeError, scanIntake } = useCollectionsAI(tenantId);

  return (
    <div>
      <button
        type="button"
        onClick={() => void scanIntake(payload)}
        disabled={isIntakeLoading}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <Sparkles className="h-4 w-4" />
        {isIntakeLoading ? "AI taranıyor..." : "AI ile takip taraması yap"}
      </button>

      {intakeError ? <p className="mt-2 text-xs font-medium text-rose-600">{intakeError}</p> : null}

      {intakeText ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            AI önerisi — henüz vaka açmaz
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {intakeText}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Bunu gerçek bir takibe dönüştürmek için aşağıdaki kuyrukta ilgili kayıtta &quot;Takip
            başlat&quot;a tıklayın.
          </p>
        </div>
      ) : null}
    </div>
  );
}
