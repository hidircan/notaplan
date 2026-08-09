"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  actionComputeTeacherPayout,
  actionCreateTeacherPayout,
  type ComputeTeacherPayoutActionResult,
} from "@/lib/actions";
import { Badge, Button, Card, Select } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function periodFor(year: number, month: number) {
  const anchor = new Date(year, month - 1, 1);
  return {
    periodStart: format(startOfMonth(anchor), "yyyy-MM-dd"),
    periodEnd: format(endOfMonth(anchor), "yyyy-MM-dd"),
  };
}

export function TeacherPayoutDashboard({
  teacherId,
  initialYear,
  initialMonth,
  initialResult,
  canWrite,
}: {
  teacherId: string;
  initialYear: number;
  initialMonth: number;
  initialResult: ComputeTeacherPayoutActionResult;
  /** "Tüm kurumlar" görünümünde false — hakediş hesaplanamaz/oluşturulamaz. */
  canWrite: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  async function fetchPeriod(nextYear: number, nextMonth: number) {
    setLoading(true);
    setCreateMessage(null);
    const { periodStart, periodEnd } = periodFor(nextYear, nextMonth);
    const next = await actionComputeTeacherPayout({ teacherId, periodStart, periodEnd });
    setResult(next);
    setLoading(false);
  }

  async function handleCreatePayout() {
    if (!result.ok) return;
    setCreating(true);
    setCreateMessage(null);
    const { periodStart, periodEnd } = periodFor(year, month);
    const created = await actionCreateTeacherPayout({ teacherId, periodStart, periodEnd });
    setCreating(false);
    if (!created.ok) {
      setCreateMessage({ ok: false, text: created.message });
      return;
    }
    setCreateMessage({
      ok: true,
      text: `Hakediş kaydı oluşturuldu: ${formatMoney(created.payout.totalAmount)}. Ödeme geçmişinden görüntüleyebilirsiniz.`,
    });
  }

  return (
    <div>
      {!canWrite ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          &quot;Tüm kurumlar&quot; görünümündesiniz — hakediş hesaplamak/oluşturmak için üstteki kurum
          seçiciden tek bir kurum seçin.
        </p>
      ) : null}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Ay</label>
            <Select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-auto"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Yıl</label>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={() => fetchPeriod(year, month)} disabled={loading || !canWrite}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Getir
          </Button>
          <Link
            href={`/panel/ogretmenler/${teacherId}/odemeler`}
            className="ml-auto text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            Ödeme geçmişini gör →
          </Link>
        </div>
      </Card>

      {!result.ok ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <p className="text-sm text-rose-700">{result.message}</p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Toplam ders</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text)] dark:text-slate-50">{result.totalLessons}</p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Toplam dakika</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text)] dark:text-slate-50">{result.totalMinutes}</p>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/40">
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Toplam hakediş</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatMoney(result.totalAmount)}</p>
            </Card>
          </div>

          {result.missingFeeRuleLessonIds.length > 0 ? (
            <Card className="mb-6 border-amber-200 bg-amber-50/60">
              <p className="text-sm text-amber-900">
                <strong>{result.missingFeeRuleLessonIds.length}</strong> derste geçerli ücret kuralı bulunamadı.
                Bu dönem için hakediş oluşturulamaz — önce{" "}
                <Link href="/panel/ucret-kurallari" className="font-medium underline">
                  Ücret Kuralları
                </Link>{" "}
                sayfasından eksik kuralı tanımlayın.
              </p>
            </Card>
          ) : null}

          <Card className="overflow-hidden p-0">
            {result.lines.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                {format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: tr })} döneminde tamamlanmış ders
                bulunamadı.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)] dark:border-slate-800 dark:bg-slate-900/60 dark:text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Öğrenci</th>
                    <th className="px-4 py-3">Şube</th>
                    <th className="px-4 py-3">Enstrüman</th>
                    <th className="px-4 py-3">Süre</th>
                    <th className="px-4 py-3">Saatlik ücret</th>
                    <th className="px-4 py-3">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((line) => (
                    <tr key={line.lessonId} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{formatDate(line.lessonDate)}</td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text)] dark:text-slate-50">
                        <Link
                          href={`/panel/ogrenciler/${line.studentId}`}
                          className="hover:text-amber-600 hover:underline"
                        >
                          {line.studentName ?? "—"}
                        </Link>
                        <Link
                          href={`/panel/program?studentId=${line.studentId}`}
                          className="block text-[11px] font-normal text-amber-700 hover:underline"
                        >
                          Kaynak ders →
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{line.branchName ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{line.instrument}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{line.durationMinutes} dk</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                        {line.perMinuteRate
                          ? `${formatMoney(Math.round(line.perMinuteRate * 60 * 100) / 100)}/sa`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {line.issue === "missing-fee-rule" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Badge status="pending">Ücret kuralı eksik</Badge>
                            <span className="text-[var(--color-text-muted)]">—</span>
                          </span>
                        ) : (
                          <span className="font-medium">{formatMoney(line.amount)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleCreatePayout}
              disabled={!result.canCreatePayout || result.lines.length === 0 || creating || !canWrite}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Hakediş oluştur
            </Button>
            {createMessage ? (
              <p className={`text-sm ${createMessage.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {createMessage.text}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
