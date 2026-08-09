"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkflowToggle({
  workflowId,
  enabled,
}: {
  workflowId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: { enabled?: boolean; runNow?: boolean }) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/workflows/${workflowId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error?.message || "İşlem başarısız");
      }
      router.refresh();
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ enabled: !enabled })}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
            enabled
              ? "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          } disabled:opacity-50`}
        >
          {enabled ? "Devre dışı bırak" : "Etkinleştir"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ runNow: true })}
          className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Şimdi çalıştır
        </button>
      </div>
      {err ? <p className="text-xs text-rose-600">{err}</p> : null}
    </div>
  );
}
