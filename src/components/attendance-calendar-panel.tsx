"use client";

/**
 * ÖNCELİK 4 — Yoklama Takvimi. Öğrenci detayında (admin/öğretmen düzenleyebilir)
 * VE veli portalında (salt okunur, `readOnly`) aynı veri kaynağını (
 * `/api/v1/attendance-calendar/month`) kullanan dönem takvimi. Güz: Eylül–
 * Haziran, Yaz: Temmuz–Ağustos + uzatma. Akademik yıl (`attYear`) ve dönem
 * (`attTerm`) URL query string'inde tutulur — sayfa yenilenince korunur.
 *
 * Bir güne tıklayınca o günün dersleri + (yalnızca `readOnly=false` iken)
 * Geldi/İşlendi/Telafi aksiyonları açılır. Kapalı günler siyah render edilir;
 * yalnızca `canEdit` (admin) aynı ekrandan zorla aç/kapat + Tutar
 * güncelleyebilir. Veli görünümünde ne override ne Tutar ne de yoklama
 * değiştirme aksiyonu render edilmez — backend zaten (assertStudentAccess +
 * admin-only tool RBAC) bunu kesin olarak da engeller, bu yalnızca UI
 * katmanındaki ikinci bir savunma.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LessonOpsActions } from "./lesson-ops-actions";
import { currentAcademicAnchorYear } from "@/lib/attendance-calendar";

/**
 * Asıl tanım `src/lib/attendance-calendar.ts`'de (`currentAcademicAnchorYear`)
 * — sunucu bileşenlerinden de (RSC) güvenle içe aktarılabilsin diye orada
 * tutulur. Burada, mevcut testlerin/çağrı sitelerinin import ettiği isimle
 * (`currentAnchorYear`) geriye dönük uyumlu, tip-daraltılmış bir sarmalayıcı
 * olarak yeniden dışa aktarılır.
 */
export function currentAnchorYear(termType: string): number {
  return currentAcademicAnchorYear(termType === "yaz" ? "yaz" : "guz");
}

type LessonPaymentInfo = {
  lessonId: string;
  amount: number;
  /** "Tutar kayıt tarihi" — bu tutarın sisteme kaydedildiği tarih-saat. */
  recordedAt: string;
  method?: string;
  methodIsStudentDefault: boolean;
  status: string;
  source: string;
};

type DayInfo = {
  date: string;
  status: "open" | "closed";
  reason: string;
  label: string;
  lessonIds: string[];
  payments: LessonPaymentInfo[];
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Nakit",
  transfer: "Havale",
  credit_card: "Kredi Kartı",
};

function formatMoneyTL(amount: number): string {
  return `${amount.toLocaleString("tr-TR")} TL`;
}

function formatRecordedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

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

export type AttendanceTerm = "guz" | "yaz";

/** Dışa açık — saf, DOM'suz test edilebilir (bkz. attendance-calendar-nav.test.ts). */
export function termMonthList(termType: string, anchorYear: number): { year: number; month: number }[] {
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
 * Dersi olan günler artık ayrıca kalın siyah çerçeve + ders sayısı rozeti
 * ile de işaretleniyor — renk körlüğünde bile tek başına ayırt edilebilir.
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
  readOnly = false,
}: {
  studentId: string;
  /** Öğrencinin kayıtlı dönemi — ilk açılışta seçili dönem olarak kullanılır, kullanıcı değiştirebilir. */
  termType: string;
  /** Admin: gün override + aylık Tutar düzenleyebilir. */
  canEdit: boolean;
  /** Veli/salt-okunur görünüm: override, Tutar, Geldi/İşlendi/Telafi aksiyonları HİÇ render edilmez. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const studentDefaultTerm: AttendanceTerm = termType === "yaz" ? "yaz" : "guz";
  const urlTerm = searchParams.get("attTerm");
  // ÖNCELİK 4 (devam) — veli (readOnly) görünümünde dönem seçimi KULLANICIYA
  // AÇILMAZ: URL'den bile değiştirilemez, her zaman öğrencinin kayıtlı
  // termType'ından otomatik çözülür. Admin/öğretmen görünümünde (readOnly
  // false) URL'deki attTerm tercih edilir, yoksa öğrencinin termType'ı.
  const urlYear = searchParams.get("attYear");
  const [term, setTerm] = useState<AttendanceTerm>(
    readOnly ? studentDefaultTerm : urlTerm === "guz" || urlTerm === "yaz" ? urlTerm : studentDefaultTerm
  );
  const [anchorYear, setAnchorYear] = useState<number>(() => {
    const parsed = urlYear ? Number(urlYear) : NaN;
    return Number.isFinite(parsed) ? parsed : currentAnchorYear(term);
  });

  const syncUrl = useCallback(
    (nextTerm: AttendanceTerm, nextYear: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("attTerm", nextTerm);
      params.set("attYear", String(nextYear));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function changeTerm(nextTerm: AttendanceTerm) {
    const nextYear = currentAnchorYear(nextTerm);
    setTerm(nextTerm);
    setAnchorYear(nextYear);
    syncUrl(nextTerm, nextYear);
  }

  function changeYear(nextYear: number) {
    setAnchorYear(nextYear);
    syncUrl(term, nextYear);
  }

  function goToday() {
    changeYear(currentAnchorYear(term));
  }

  const months = useMemo(() => termMonthList(term, anchorYear), [term, anchorYear]);
  const [byMonth, setByMonth] = useState<Record<string, MonthResponse>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [savingMonth, setSavingMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMonths = useCallback(async () => {
    setLoading(true);
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
    setByMonth(results);
    setLoading(false);
  }, [studentId, months]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadMonths();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, months]);

  function onDayClick(day: DayInfo) {
    setSelectedDay(day.date);
    setError(null);
  }

  async function onToggleOverride(day: DayInfo) {
    if (!canEdit || readOnly) return;
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
    if (!canEdit || readOnly) return;
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

  const isCurrentAnchor = anchorYear === currentAnchorYear(term);

  return (
    <div className="space-y-4">
      {/* Sabit renk lejantı */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs">
        <LegendDot color="#16a34a" label="Geldi" />
        <LegendDot color="#dc2626" label="İşlendi" />
        <LegendDot color="#ca8a04" label="Telafi" />
        <LegendDot color="#0a0a0a" label="Kapalı" />
        <LegendDot color="#e5e7eb" label="Açık / işaretsiz" />
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-black bg-[#93c5fd]" />
          Planlı dersi olan gün
        </span>
      </div>

      {/* Dönem + akademik yıl gezinme */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        {readOnly ? (
          // ÖNCELİK 4 (devam) — veli görünümünde dönem seçici YOK; sistem
          // öğrencinin kayıtlı dönemini otomatik gösterir (salt bilgi etiketi).
          <span className="rounded-md bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">
            {term === "guz" ? "Güz dönemi" : "Yaz dönemi"} (öğrencinin kayıtlı dönemi)
          </span>
        ) : (
          <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5" role="group" aria-label="Dönem seçimi">
            <button
              type="button"
              aria-pressed={term === "guz"}
              onClick={() => changeTerm("guz")}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold transition",
                term === "guz" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
              )}
            >
              Güz
            </button>
            <button
              type="button"
              aria-pressed={term === "yaz"}
              onClick={() => changeTerm("yaz")}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold transition",
                term === "yaz" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
              )}
            >
              Yaz
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Önceki akademik yıl"
            onClick={() => changeYear(anchorYear - 1)}
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs font-semibold hover:bg-[var(--color-bg)]"
          >
            ← {term === "guz" ? `${anchorYear - 1}–${anchorYear}` : anchorYear - 1}
          </button>
          <span className="rounded-md bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">
            {term === "guz" ? `${anchorYear}–${anchorYear + 1} Güz` : `${anchorYear} Yaz`}
          </span>
          <button
            type="button"
            aria-label="Sonraki akademik yıl"
            onClick={() => changeYear(anchorYear + 1)}
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs font-semibold hover:bg-[var(--color-bg)]"
          >
            {term === "guz" ? `${anchorYear + 1}–${anchorYear + 2}` : anchorYear + 1} →
          </button>
          {!isCurrentAnchor ? (
            <button
              type="button"
              onClick={goToday}
              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Bugün
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-[#f8ecec] px-3 py-2 text-xs font-medium text-[#6b2424]" role="alert">
          {error}
        </p>
      ) : null}

      {loading && Object.keys(byMonth).length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Takvim yükleniyor…</p>
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
                {canEdit && !readOnly ? (
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
                <p className="text-xs text-[var(--color-text-muted)]">
                  {months.some((mm) => `${mm.year}-${mm.month}` === key) && !loading ? "Bu dönem için ders yok / veri bulunamadı." : "Yükleniyor…"}
                </p>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {data.days.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      title={`${day.date} — ${day.label}${day.lessonIds.length ? ` · ${day.lessonIds.length} ders` : ""}`}
                      onClick={() => onDayClick(day)}
                      className={cn(
                        "relative aspect-square rounded text-[10px] font-semibold text-white transition",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]",
                        "hover:brightness-95 active:brightness-90",
                        day.lessonIds.length > 0 && "border-2 border-black",
                        selectedDay === day.date && "ring-2 ring-[var(--color-primary)]"
                      )}
                      style={{ backgroundColor: dayColor(day) }}
                    >
                      {Number(day.date.slice(8, 10))}
                      {day.lessonIds.length > 1 ? (
                        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[8px] font-bold text-white">
                          {day.lessonIds.length}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}

              {selectedDay && data?.days.some((d) => d.date === selectedDay) ? (
                <DayDetail
                  day={data.days.find((d) => d.date === selectedDay)!}
                  canEdit={canEdit}
                  readOnly={readOnly}
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
  readOnly,
  onToggleOverride,
}: {
  day: DayInfo;
  canEdit: boolean;
  readOnly: boolean;
  onToggleOverride: (day: DayInfo) => void | Promise<void>;
}) {
  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--color-text)]">
          {day.date} · {day.label}
        </p>
        {canEdit && !readOnly ? (
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
      ) : readOnly ? (
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          Bu gün {day.lessonIds.length} ders planlı. Durum güncellemeleri okul yönetimi tarafından yapılır.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {day.lessonIds.map((lessonId) => (
            <LessonOpsActions key={lessonId} lessonId={lessonId} compact />
          ))}
        </div>
      )}
      {day.payments.length > 0 ? (
        <div className="mt-2 space-y-1.5 border-t border-[var(--color-border)] pt-2">
          {day.payments.map((p) => (
            <div key={p.lessonId} className="rounded-md bg-[var(--color-surface)] p-1.5 text-[11px]">
              <p className="font-semibold text-[var(--color-text)]">{formatMoneyTL(p.amount)}</p>
              <p className="text-[var(--color-text-muted)]">Tutar kayıt tarihi: {formatRecordedAt(p.recordedAt)}</p>
              <p className="text-[var(--color-text-muted)]">
                Ödeme şekli: {p.method ? PAYMENT_METHOD_LABEL[p.method] ?? p.method : "Belirtilmemiş"}
                {p.methodIsStudentDefault ? " (öğrenci varsayılanı — tahmini)" : ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
