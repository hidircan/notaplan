"use client";

/**
 * ÖNCELİK 4 — Yoklama Takvimi. Öğrenci detayında dönem takvimini (Güz:
 * Eylül–Haziran, Yaz: Temmuz–Ağustos + uzatma) ay ay gösterir. Bir güne
 * tıklayınca o günün dersleri + Geldi/İşlendi/Telafi aksiyonları açılır.
 * Kapalı günler siyah render edilir; admin aynı ekrandan zorla aç/kapat
 * yapabilir. Her ay başlığında yalnızca düzenlenebilir bir "Tutar" alanı var.
 */

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { LessonOpsActions } from "./lesson-ops-actions";

type DayInfo = {
  date: string;
  status: "open" | "closed";
  reason: string;
  label: string;
  lessonIds: string[];
};

type MonthResponse = {
  year: number;
  month: number;
  term: string;
  days: DayInfo[];
};

const MONTH_LABELS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function termMonthList(termType: string, anchorYear: number): { year: number; month: number }[] {
  if (termType === "yaz") {
    return [
      { year: anchorYear, month: 7 },
      { year: anchorYear, month: 8 },
      { year: anchorYear, month: 9 },
    ];
  }
  const months: { year: number; month: number }[] = [];
  for (let m = 9; m <= 12; m++) months.push({ year: anchorYear, month: m });
  for (let m = 1; m <= 6; m++) months.push({ year: anchorYear + 1, month: m });
  return months;
}

/**
 * NOT (bilinen kısıtlama): `/attendance-calendar/month` yalnızca lessonId
 * listesi döner (Geldi/İşlendi/Telafi bayrakları değil) — bu yüzden kutu
 * rengi burada sadece açık/kapalı ayrımını yansıtır; günün içindeki derse
 * tıklanınca gerçek Geldi/İşlendi/Telafi durumu `LessonOpsActions` ile
 * görülüp değiştirilebilir. Tam renk-kodlu ızgara için API'nin lesson
 * flag'lerini de döndürecek şekilde genişletilmesi gerekir (sonraki iterasyon).
 */
function dayColor(day: DayInfo): string {
  if (day.status === "closed") return "#0a0a0a";
  if (day.lessonIds.length > 0) return "#93c5fd"; // dersi olan açık gün — nötr mavi
  return "#e5e7eb";
}

export function AttendanceCalendarPanel({
  studentId,
  termType,
  canEdit,
}: {
  studentId: string;
  termType: string;
  canEdit: boolean;
}) {
  const anchorYear = useMemo(() => {
    const now = new Date();
    return termType === "yaz" ? now.getFullYear() : now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  }, [termType]);

  const months = useMemo(() => termMonthList(termType, anchorYear), [termType, anchorYear]);
  const [byMonth, setByMonth] = useState<Record<string, MonthResponse>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [savingMonth, setSavingMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Record<string, MonthResponse> = {};
      for (const m of months) {
        try {
          const res = await fetch(
            `/api/v1/attendance-calendar/month?studentId=${studentId}&year=${m.year}&month=${m.month}`
          );
          const json = (await res.json()) as { ok: boolean; data?: MonthResponse };
          if (json.ok && json.data) results[`${m.year}-${m.month}`] = json.data;
        } catch {
          // sessizce atla — bir ayın hatası tüm takvimi bozmasın
        }
      }
      if (!cancelled) setByMonth(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, months]);

  function onDayClick(day: DayInfo) {
    setSelectedDay(day.date);
    setError(null);
  }

  async function onToggleOverride(day: DayInfo) {
    if (!canEdit) return;
    setError(null);
    try {
      const res = await fetch("/api/v1/attendance-calendar/day-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: day.date,
          isOpen: day.status === "closed",
          name: day.status === "closed" ? "Zorla açık" : "Kapalı (yönetici)",
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "İşlem başarısız.");
        return;
      }
      // İlgili ayı yeniden çek
      const [y, m] = day.date.split("-");
      const res2 = await fetch(
        `/api/v1/attendance-calendar/month?studentId=${studentId}&year=${y}&month=${Number(m)}`
      );
      const json2 = (await res2.json()) as { ok: boolean; data?: MonthResponse };
      if (json2.ok && json2.data) {
        setByMonth((prev) => ({ ...prev, [`${Number(y)}-${Number(m)}`]: json2.data! }));
      }
    } catch {
      setError("Bağlantı hatası.");
    }
  }

  async function onSaveAmount(key: string) {
    if (!canEdit) return;
    const raw = amounts[key];
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Geçerli bir tutar girin.");
      return;
    }
    setSavingMonth(key);
    setError(null);
    try {
      const [year, month] = key.split("-").map(Number);
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const res = await fetch("/api/v1/attendance-calendar/monthly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, month: monthStr, amount }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) setError(json.error?.message ?? "Tutar kaydedilemedi.");
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSavingMonth(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sabit renk lejantı */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs">
        <LegendDot color="#16a34a" label="Geldi" />
        <LegendDot color="#dc2626" label="İşlendi" />
        <LegendDot color="#ca8a04" label="Telafi" />
        <LegendDot color="#0a0a0a" label="Kapalı" />
        <LegendDot color="#e5e7eb" label="Açık / işaretsiz" />
      </div>

      {error ? (
        <p className="rounded-md bg-[#f8ecec] px-3 py-2 text-xs font-medium text-[#6b2424]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => {
          const key = `${m.year}-${m.month}`;
          const data = byMonth[key];
          return (
            <div key={key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {MONTH_LABELS[m.month - 1]} {m.year}
                </h3>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      placeholder="Tutar"
                      value={amounts[key] ?? ""}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-24 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                      aria-label={`${MONTH_LABELS[m.month - 1]} tutarı`}
                    />
                    <button
                      type="button"
                      disabled={savingMonth === key}
                      onClick={() => void onSaveAmount(key)}
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-semibold text-stone-800 hover:border-[#A56A00] hover:bg-[#fbf6ee] disabled:opacity-50"
                    >
                      {savingMonth === key ? "…" : "Kaydet"}
                    </button>
                  </div>
                ) : null}
              </div>

              {!data ? (
                <p className="text-xs text-[var(--color-text-muted)]">Yükleniyor…</p>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {data.days.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      title={`${day.date} — ${day.label}`}
                      onClick={() => onDayClick(day)}
                      className={cn(
                        "aspect-square rounded text-[10px] font-semibold text-white transition",
                        selectedDay === day.date && "ring-2 ring-[var(--color-primary)]"
                      )}
                      style={{ backgroundColor: dayColor(day) }}
                    >
                      {Number(day.date.slice(8, 10))}
                    </button>
                  ))}
                </div>
              )}

              {selectedDay && data?.days.some((d) => d.date === selectedDay) ? (
                <DayDetail
                  day={data.days.find((d) => d.date === selectedDay)!}
                  canEdit={canEdit}
                  onToggleOverride={onToggleOverride}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function DayDetail({
  day,
  canEdit,
  onToggleOverride,
}: {
  day: DayInfo;
  canEdit: boolean;
  onToggleOverride: (day: DayInfo) => void | Promise<void>;
}) {
  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--color-text)]">
          {day.date} · {day.label}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void onToggleOverride(day)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-semibold text-stone-800 hover:border-[#A56A00] hover:bg-[#fbf6ee]"
          >
            {day.status === "closed" ? "Zorla Aç" : "Kapat"}
          </button>
        ) : null}
      </div>
      {day.status === "closed" ? (
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          Kapalı gün — yoklama/tahsilat işlemi yapılamaz.
        </p>
      ) : day.lessonIds.length === 0 ? (
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Bu gün ders yok.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {day.lessonIds.map((lessonId) => (
            <LessonOpsActions key={lessonId} lessonId={lessonId} compact />
          ))}
        </div>
      )}
    </div>
  );
}
