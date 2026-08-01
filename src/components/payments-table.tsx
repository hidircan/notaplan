"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { actionMarkPaymentPaid } from "@/lib/actions";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types";

export type PaymentRow = {
  id: string;
  studentId: string;
  studentName: string;
  description: string;
  method?: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: PaymentStatus;
};

type StatusFilter = "all" | PaymentStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "pending", label: "Bekliyor" },
  { value: "overdue", label: "Gecikmiş" },
  { value: "partial", label: "Kısmi ödeme" },
  { value: "paid", label: "Ödendi" },
];

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionOnly, setActionOnly] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !row.studentName.toLowerCase().includes(query)) return false;
      if (actionOnly) return row.status === "overdue" || row.status === "partial";
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter, actionOnly]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Öğrenci adına göre ara..."
          aria-label="Öğrenci adına göre ara"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2 sm:w-auto"
        />

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setStatusFilter(filter.value);
                setActionOnly(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                !actionOnly && statusFilter === filter.value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActionOnly((value) => !value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              actionOnly
                ? "bg-rose-600 text-white"
                : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            Aksiyon gerekenler
          </button>
        </div>

        <span className="ml-auto text-xs font-medium text-slate-500">
          {filtered.length} sonuç
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Öğrenci</th>
              <th className="px-4 py-3">Açıklama</th>
              <th className="px-4 py-3">Vade</th>
              <th className="px-4 py-3">Tutar</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Bu filtreye uyan ödeme bulunamadı.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      href={`/panel/odemeler/${p.studentId}`}
                      className="hover:text-violet-600 hover:underline"
                    >
                      {p.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.description}
                    {p.method ? (
                      <span className="block text-xs text-slate-400">{p.method}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{formatMoney(p.amount)}</span>
                    {p.paidAmount > 0 && p.paidAmount < p.amount ? (
                      <span className="block text-xs text-slate-400">
                        Ödenen: {formatMoney(p.paidAmount)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    {p.status !== "paid" ? (
                      <form action={actionMarkPaymentPaid}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <Button type="submit" variant="secondary" className="!py-1.5 text-xs">
                          Ödendi işaretle
                        </Button>
                      </form>
                    ) : (
                      <Link
                        href={`/makbuz/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <Receipt className="h-3.5 w-3.5" /> Makbuzu görüntüle
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
