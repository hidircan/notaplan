"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { actionUpdateCollectionsSettings } from "@/lib/actions";

export function CollectionsSettingsForm({
  frequencyLimitDays,
  autoSendEnabled,
}: {
  frequencyLimitDays: number;
  autoSendEnabled: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState(frequencyLimitDays);
  const [autoSend, setAutoSend] = useState(autoSendEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    const result = await actionUpdateCollectionsSettings({
      frequencyLimitDays: days,
      autoSendEnabled: autoSend,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-3 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Aynı ödeme için hatırlatmalar arası en az gün
        </label>
        <input
          type="number"
          min={1}
          max={30}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={autoSend}
          onChange={(event) => setAutoSend(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Taslak mesajları otomatik onayla (varsayılan: kapalı — her mesaj admin onayı bekler)
      </label>
      <p className="text-xs text-slate-400">
        Otomatik onay açık olsa bile WhatsApp gönderimi (wa.me) her zaman bir kişinin linke
        tıklamasını gerektirir — hiçbir mesaj sistem tarafından otomatik gönderilmez.
      </p>
      <Button type="submit" variant="secondary" disabled={busy}>
        {busy ? "Kaydediliyor..." : "Ayarları kaydet"}
      </Button>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="text-xs font-medium text-emerald-600">Kaydedildi.</p> : null}
    </form>
  );
}
