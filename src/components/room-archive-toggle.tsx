"use client";

/** ÖNCELİK 4 (devam) — oda pasife alma/geri alma (hard delete YOK). */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionUpdateRoom } from "@/lib/actions";

export function RoomArchiveToggle({ roomId, active }: { roomId: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    setError(null);
    startTransition(async () => {
      const result = await actionUpdateRoom({ roomId, active: !active });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={onToggle}
        className={
          active
            ? "rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            : "rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        }
      >
        {pending ? "…" : active ? "Pasife Al" : "Aktifleştir"}
      </button>
      {error ? <p className="mt-1 text-[11px] font-medium text-[#8b3a3a]">{error}</p> : null}
    </div>
  );
}
