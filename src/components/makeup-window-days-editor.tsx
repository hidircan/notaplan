"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionUpdateMakeupWindowDays } from "@/lib/actions";

export function MakeupWindowDaysEditor({
  currentDays,
  canWrite,
}: {
  currentDays: number;
  /** "Tüm kurumlar" görünümünde false — politika değiştirilemez. */
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentDays));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      setError("1-365 arası tam sayı girin.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await actionUpdateMakeupWindowDays(parsed);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        <p className="text-sm text-amber-800">Politika penceresi</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-3xl font-semibold text-amber-950">{currentDays} gün</p>
          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setValue(String(currentDays));
                setError(null);
                setEditing(true);
              }}
              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Düzenle
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-amber-800">Politika penceresi</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={365}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Telafi politika penceresi (gün)"
          className="w-20 rounded-md border border-amber-300 bg-white px-2 py-1 text-lg font-semibold text-amber-950 outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSave()}
          className="rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {submitting ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Vazgeç
        </button>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
