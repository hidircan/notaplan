"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import { dayName } from "@/lib/utils";
import type { AvailabilityWindow } from "@/lib/types";

/**
 * Pazartesi(1)..Cumartesi(6),Pazar(0) — `dayName`/backend şema ile aynı
 * 0=Pazar..6=Cumartesi eşlemesi (JS `Date.getDay()`), Pazar listenin sonuna
 * eklendi (mevcut sıralamayla tutarlı, yalnızca ekleme).
 */
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0];

type BlockRow = { dayOfWeek: number; start: string; end: string };

function toRows(current: AvailabilityWindow[]): BlockRow[] {
  if (current.length === 0) return [{ dayOfWeek: 1, start: "10:00", end: "18:00" }];
  return current.map((w) => ({ dayOfWeek: w.dayOfWeek, start: w.start, end: w.end }));
}

function timesOverlap(a: BlockRow, b: BlockRow): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.start < b.end && b.start < a.end;
}

/**
 * Öğretmenin kendi müsaitliğini DÜZENLEDİĞİ (öneri gönderdiği) form.
 * Pazar (dayOfWeek=0) dahil TÜM günler seçilebilir; herhangi bir gün için
 * (Pazar dahil) BİRDEN FAZLA saat aralığı bloğu eklenebilir — bu yüzden
 * "gün başına tek satır" değil, her biri kendi gün seçicisine sahip serbest
 * bir blok LİSTESİDİR (bkz. TeacherAvailabilityField ile aynı desen,
 * oluşturma formunda kullanılan). Aynı gün içindeki bloklar arasında
 * çakışma (overlap) engellenir.
 */
export function TeacherAvailabilityForm({ current }: { current: AvailabilityWindow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<BlockRow[]>(() => toRows(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function addRow() {
    setRows((prev) => [...prev, { dayOfWeek: 1, start: "10:00", end: "18:00" }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<BlockRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  const invalidIndexes = new Set<number>();
  const overlapIndexes = new Set<number>();
  rows.forEach((r, i) => {
    if (r.start >= r.end) invalidIndexes.add(i);
    for (let j = 0; j < rows.length; j++) {
      if (j === i) continue;
      if (timesOverlap(r, rows[j]!)) {
        overlapIndexes.add(i);
        overlapIndexes.add(j);
      }
    }
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (invalidIndexes.size > 0) {
      setError("Bitiş saati başlangıçtan sonra olmalı.");
      return;
    }
    if (overlapIndexes.size > 0) {
      setError("Aynı gün için çakışan saat aralıkları var — lütfen düzeltin.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/v1/teachers/availability/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedAvailability: rows.map((r) => ({
            dayOfWeek: r.dayOfWeek,
            start: r.start,
            end: r.end,
          })),
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Öneri gönderilemedi.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {rows.map((row, idx) => (
        <div
          key={idx}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <Select
            value={row.dayOfWeek}
            onChange={(e) => updateRow(idx, { dayOfWeek: Number(e.target.value) })}
            className="!w-auto flex-1"
            aria-label="Gün"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {dayName(d)}
              </option>
            ))}
          </Select>
          <Input
            type="time"
            value={row.start}
            onChange={(e) => updateRow(idx, { start: e.target.value })}
            className="!w-28"
          />
          <span className="text-xs text-slate-400">–</span>
          <Input
            type="time"
            value={row.end}
            onChange={(e) => updateRow(idx, { end: e.target.value })}
            className="!w-28"
          />
          <button
            type="button"
            onClick={() => removeRow(idx)}
            aria-label="Satırı sil"
            className="ml-auto rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:border-rose-300 hover:text-rose-600"
          >
            Sil
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-stone-300 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:border-cyan-400 hover:bg-cyan-50"
      >
        + Saat Aralığı Ekle
      </button>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {success ? (
        <p className="text-sm font-medium text-emerald-600">
          Öneri gönderildi — yönetici onayı bekleniyor.
        </p>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Gönderiliyor…" : "Öneriyi gönder"}
      </Button>
    </form>
  );
}
