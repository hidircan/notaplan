"use client";

/**
 * Shared "AI ile özetle / öner / analiz üret / yorumla" button + result
 * card, for the read-only, no-approval capabilities. One small client
 * component reused across Yoklama / Telafi / Tahsilat / Öğretmenler /
 * Öğrenciler instead of duplicating the button+card+loading+error markup
 * per screen.
 */
import { Sparkles } from "lucide-react";
import { useAiInsight, type InsightCapabilityId } from "@/hooks/useAiInsight";

export function AiInsightTrigger({
  capabilityId,
  label,
  payload,
}: {
  capabilityId: InsightCapabilityId;
  label: string;
  payload: Record<string, unknown>;
}) {
  const { text, isLoading, error, generate } = useAiInsight(capabilityId);

  return (
    <div>
      <button
        type="button"
        onClick={() => void generate(payload)}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-800 transition hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
      >
        <Sparkles className="h-4 w-4" />
        {isLoading ? "AI hazırlıyor..." : label}
      </button>

      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}

      {text ? (
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 dark:border-violet-800 dark:bg-violet-950/30">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            AI özeti
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-muted)] dark:text-slate-300">{text}</p>
        </div>
      ) : null}
    </div>
  );
}
