"use client";

/**
 * Öğretmen oluşturma anında haftalık müsaitlik girişi. Öncesinde müsaitlik
 * yalnızca oluşturma sonrası (Müsaitlik ekranındaki öneri/onay akışıyla)
 * belirlenebiliyordu — burada admin, ekleme formunda doğrudan gün/saat
 * seçebilir. Satırlar `name` prop'uyla verilen gizli bir input'a JSON dizisi
 * olarak yazılır (bkz. TeacherInstrumentsField ile aynı desen); boş bırakılırsa
 * createTeacherTool'daki mevcut varsayılan müsaitliğe (Pzt–Cum 10–18/16) düşülür.
 */

import { useState } from "react";
import { dayName } from "@/lib/utils";
import { Input } from "@/components/ui";

export type AvailabilityWindowRow = { dayOfWeek: number; start: string; end: string };

const WEEKDAYS = [1, 2, 3, 4, 5, 6]; // Pzt–Cts (Pazar hariç, mevcut varsayılanla tutarlı)

export function TeacherAvailabilityField({
  name,
  initialRows,
}: {
  /** Hidden input adı — form submit'te JSON string olarak gönderilir. */
  name: string;
  initialRows?: AvailabilityWindowRow[];
}) {
  const [enabled, setEnabled] = useState<Record<number, boolean>>(() => {
    if (initialRows && initialRows.length > 0) {
      const map: Record<number, boolean> = {};
      for (const d of WEEKDAYS) map[d] = initialRows.some((r) => r.dayOfWeek === d);
      return map;
    }
    // Varsayılan: Pzt–Cum işaretli, Cts değil — mevcut createTeacherTool
    // varsayılanıyla aynı görünüm.
    return { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false };
  });
  const [times, setTimes] = useState<Record<number, { start: string; end: string }>>(() => {
    const map: Record<number, { start: string; end: string }> = {};
    for (const d of WEEKDAYS) {
      const existing = initialRows?.find((r) => r.dayOfWeek === d);
      map[d] = existing
        ? { start: existing.start, end: existing.end }
        : { start: "10:00", end: d === 5 ? "16:00" : "18:00" };
    }
    return map;
  });

  const rows: AvailabilityWindowRow[] = WEEKDAYS.filter((d) => enabled[d]).map((d) => ({
    dayOfWeek: d,
    start: times[d]!.start,
    end: times[d]!.end,
  }));

  const json = JSON.stringify(rows);

  const invalidDays = WEEKDAYS.filter((d) => enabled[d] && times[d]!.start >= times[d]!.end);

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={json} />
      {WEEKDAYS.map((d) => (
        <div key={d} className="flex items-center gap-2">
          <label className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={enabled[d] ?? false}
              onChange={(e) => setEnabled((prev) => ({ ...prev, [d]: e.target.checked }))}
              className="h-3.5 w-3.5"
            />
            {dayName(d)}
          </label>
          <Input
            type="time"
            value={times[d]!.start}
            disabled={!enabled[d]}
            onChange={(e) => setTimes((prev) => ({ ...prev, [d]: { ...prev[d]!, start: e.target.value } }))}
            className="!w-auto flex-1"
            aria-label={`${dayName(d)} başlangıç`}
          />
          <span className="text-xs text-slate-400">–</span>
          <Input
            type="time"
            value={times[d]!.end}
            disabled={!enabled[d]}
            onChange={(e) => setTimes((prev) => ({ ...prev, [d]: { ...prev[d]!, end: e.target.value } }))}
            className="!w-auto flex-1"
            aria-label={`${dayName(d)} bitiş`}
          />
        </div>
      ))}
      {invalidDays.length > 0 ? (
        <p className="text-[11px] font-medium text-[#8b3a3a]" role="alert">
          Bitiş saati başlangıçtan sonra olmalı ({invalidDays.map((d) => dayName(d)).join(", ")}).
        </p>
      ) : null}
    </div>
  );
}
