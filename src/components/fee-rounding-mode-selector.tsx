"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionUpdateFeeRoundingMode } from "@/lib/actions";
import { Button, Card, Label, Select } from "@/components/ui";
import type { FeeRoundingMode } from "@/lib/types";

const MODE_LABELS: Record<FeeRoundingMode, string> = {
  exact_minutes: "Gerçek dakika (varsayılan)",
  round_30: "30 dakikaya yukarı yuvarla",
  fixed_package: "Kurumun standart ders süresini esas al",
};

const MODE_DESCRIPTIONS: Record<FeeRoundingMode, string> = {
  exact_minutes: "Her ders, gerçekleşen dakikası üzerinden ödenir.",
  round_30: "Örn. 35 dk → 60 dk, 65 dk → 90 dk olarak ödenir (öğretmen lehine).",
  fixed_package: "Ders süresi ne olursa olsun, kurulum ayarlarındaki standart ders süresi üzerinden ödenir.",
};

export function FeeRoundingModeSelector({
  currentMode,
  canWrite,
}: {
  currentMode: FeeRoundingMode;
  /** "Tüm kurumlar" görünümünde false — politika değiştirilemez. */
  canWrite: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<FeeRoundingMode>(currentMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const result = await actionUpdateFeeRoundingMode(mode);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess("Kesirli süre politikası güncellendi.");
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <h2 className="font-semibold text-[var(--color-text)] dark:text-slate-50">Kesirli ders süresi politikası</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
        Bir dersin gerçek süresi, ödenecek dakikaya nasıl çevrilsin? Bu ayar yalnızca bundan
        sonra hesaplanacak hakedişleri etkiler — daha önce oluşturulmuş hakediş kayıtları asla
        yeniden hesaplanmaz.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label>Politika</Label>
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as FeeRoundingMode)}
            disabled={!canWrite}
          >
            {(Object.keys(MODE_LABELS) as FeeRoundingMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{MODE_DESCRIPTIONS[mode]}</p>
        </div>
        <Button type="submit" disabled={submitting || !canWrite || mode === currentMode}>
          {submitting ? "Kaydediliyor…" : "Politikayı kaydet"}
        </Button>
      </form>
      {!canWrite ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          &quot;Tüm kurumlar&quot; görünümündesiniz — bu politikayı değiştirmek için üstteki kurum
          seçiciden tek bir kurum seçin.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-emerald-600">{success}</p> : null}
    </Card>
  );
}
