"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { actionMarkTeacherPayoutPaid } from "@/lib/actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import type { TeacherPayout } from "@/lib/types";

function PendingPayoutRow({ payout }: { payout: TeacherPayout }) {
  const router = useRouter();
  const [method, setMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkPaid() {
    setSubmitting(true);
    setError(null);
    const result = await actionMarkTeacherPayoutPaid({ payoutId: payout.id, method: method || undefined });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-b border-slate-50 dark:border-slate-800">
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
        {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{payout.totalMinutes} dk</td>
      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">{formatMoney(payout.totalAmount)}</td>
      <td className="px-4 py-3">
        <Badge status={payout.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Ödeme yöntemi (opsiyonel)"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-40 !py-1.5 text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            className="!py-1.5 text-xs"
            onClick={handleMarkPaid}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Ödendi olarak işaretle
          </Button>
        </div>
        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      </td>
    </tr>
  );
}

export function TeacherPayoutHistory({ payouts }: { payouts: TeacherPayout[] }) {
  const pending = payouts
    .filter((p) => p.status === "pending")
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const paid = payouts
    .filter((p) => p.status === "paid")
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-50">Bekleyen alacaklar</h2>
        {pending.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 dark:text-slate-400">Bekleyen hakediş kaydı yok.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Dönem</th>
                  <th className="px-4 py-3">Dakika</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <PendingPayoutRow key={p.id} payout={p} />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-50">Geçmiş ödemeler</h2>
        {paid.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 dark:text-slate-400">Henüz ödenmiş hakediş kaydı yok.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Dönem</th>
                  <th className="px-4 py-3">Dakika</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Ödeme tarihi</th>
                  <th className="px-4 py-3">Yöntem</th>
                </tr>
              </thead>
              <tbody>
                {paid.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.totalMinutes} dk</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">{formatMoney(p.totalAmount)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.paidAt ? formatDate(p.paidAt) : "—"}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.method ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
