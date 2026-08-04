"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { dayName } from "@/lib/utils";
import type { AvailabilityWindow } from "@/lib/types";

type DayRow = { dayOfWeek: number; enabled: boolean; start: string; end: string };

function toRows(current: AvailabilityWindow[]): DayRow[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const existing = current.find((w) => w.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      enabled: Boolean(existing),
      start: existing?.start ?? "10:00",
      end: existing?.end ?? "18:00",
    };
  });
}

export function TeacherAvailabilityForm({ current }: { current: AvailabilityWindow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<DayRow[]>(() => toRows(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateRow(dayOfWeek: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const enabled = rows.filter((r) => r.enabled);
    const invalid = enabled.find((r) => r.start >= r.end);
    if (invalid) {
      setError(`${dayName(invalid.dayOfWeek)}: bitiş saati başlangıçtan sonra olmalı.`);
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
          proposedAvailability: enabled.map((r) => ({
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
      {rows.map((row) => (
        <div
          key={row.dayOfWeek}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <label className="flex w-24 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => updateRow(row.dayOfWeek, { enabled: e.target.checked })}
            />
            {dayName(row.dayOfWeek)}
          </label>
          <Input
            type="time"
            value={row.start}
            disabled={!row.enabled}
            onChange={(e) => updateRow(row.dayOfWeek, { start: e.target.value })}
            className="!w-28"
          />
          <span className="text-xs text-slate-400">–</span>
          <Input
            type="time"
            value={row.end}
            disabled={!row.enabled}
            onChange={(e) => updateRow(row.dayOfWeek, { end: e.target.value })}
            className="!w-28"
          />
        </div>
      ))}

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
