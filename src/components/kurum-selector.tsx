"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { actionSetKurum } from "@/lib/actions";

const ALL_KURUMLAR = "ALL";

export type KurumOption = { tenantId: string; name: string };

/**
 * Görünür kurum seçici — kurum müdürü (SCHOOL_ADMIN) yalnızca kendi kurumu
 * arasında seçebilir; kurum sahibi (SUPER_ADMIN) ayrıca "Tüm kurumlar"ı
 * seçebilir. Tek kurum varsa ve "Tüm kurumlar" seçeneği anlamlı değilse
 * (SCHOOL_ADMIN), karmaşık bir seçici yerine düz bir etiket gösterilir —
 * yanıltıcı bir tek-seçenekli dropdown olmasın diye.
 */
export function KurumSelector({
  available,
  selection,
  canSeeAll,
}: {
  available: KurumOption[];
  selection: string;
  canSeeAll: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(selection);

  const selectedName =
    selection === ALL_KURUMLAR
      ? "Tüm kurumlar"
      : available.find((k) => k.tenantId === selection)?.name ?? "Kurum seçilmedi";

  if (!canSeeAll && available.length <= 1) {
    return (
      <div className="mt-4 rounded-xl bg-white/5 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Building2 className="h-3 w-3" /> Kurum
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-amber-200">{selectedName}</p>
      </div>
    );
  }

  function handleChange(next: string) {
    setValue(next);
    startTransition(async () => {
      await actionSetKurum(next);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-xl bg-white/5 px-3 py-2">
      <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <Building2 className="h-3 w-3" /> Kurum
        {pending ? <Loader2 className="h-3 w-3 animate-spin text-amber-300" /> : null}
      </label>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Görüntülenen kurumu değiştir"
        className="mt-1 w-full rounded-lg border border-white/10 bg-[#1a1428] px-2 py-1.5 text-xs font-medium text-amber-100 outline-none focus:border-amber-400 disabled:opacity-60"
      >
        {canSeeAll ? <option value={ALL_KURUMLAR}>Tüm kurumlar</option> : null}
        {available.map((k) => (
          <option key={k.tenantId} value={k.tenantId}>
            {k.name}
          </option>
        ))}
      </select>
    </div>
  );
}
