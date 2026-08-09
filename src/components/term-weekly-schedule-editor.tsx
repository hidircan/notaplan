"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionUpdateTermWeeklyClosedDays } from "@/lib/actions";
import { Button, Card } from "@/components/ui";

const WEEKDAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"];

function toggle(list: number[], day: number): number[] {
  return list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort();
}

export function TermWeeklyScheduleEditor({
  initialGuz,
  initialYaz,
}: {
  /** Güz için varsayılan/mevcut kapalı gün listesi (0=Pazar..6=Cumartesi). */
  initialGuz: number[];
  initialYaz: number[];
}) {
  const router = useRouter();
  const [guz, setGuz] = useState(initialGuz);
  const [yaz, setYaz] = useState(initialYaz);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const result = await actionUpdateTermWeeklyClosedDays({ guz, yaz });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess("Çalışma takvimi güncellendi.");
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <h2 className="font-semibold text-[var(--color-text)]">Çalışma Takvimi (dönem bazlı)</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Her dönem için haftanın hangi günleri KAPALI olduğunu belirleyin — ders planlama ve
        yoklama takvimi bu kuralı kullanır. Bu değişiklik yalnızca bundan sonraki planlama/yoklama
        kontrollerini etkiler; geçmiş dersler geriye dönük bozulmaz.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Güz dönemi — kapalı günler
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                aria-pressed={guz.includes(day)}
                onClick={() => setGuz((prev) => toggle(prev, day))}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  guz.includes(day)
                    ? "bg-rose-600 text-white"
                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Yaz dönemi — kapalı günler
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                aria-pressed={yaz.includes(day)}
                onClick={() => setYaz((prev) => toggle(prev, day))}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  yaz.includes(day)
                    ? "bg-rose-600 text-white"
                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm font-medium text-emerald-600">{success}</p> : null}

      <div className="mt-4">
        <Button type="button" onClick={() => void handleSave()} disabled={submitting}>
          {submitting ? "Kaydediliyor…" : "Çalışma takvimini kaydet"}
        </Button>
      </div>
    </Card>
  );
}
