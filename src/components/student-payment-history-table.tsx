"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { PaginationControls, usePagination } from "@/components/pagination-controls";
import type { Payment } from "@/lib/types";

/**
 * Öğrenci "Ödeme geçmişi" tablosu — yalnızca gerçekleşmiş hareketler
 * (bkz. filterPaymentHistory, çağıran sayfada uygulanır). Liste uzayabildiği
 * için sayfalama (10/30/50) burada, öğrenciler/ödemeler listeleriyle AYNI
 * ortak `PaginationControls`/`usePagination` ile uygulanır.
 */
export function StudentPaymentHistoryTable({ payments }: { payments: Payment[] }) {
  const { pageItems, page, setPage, pageSize, setPageSize, totalPages, totalCount } = usePagination(payments, 10);

  if (payments.length === 0) {
    return (
      <EmptyState title="Ödeme kaydı yok" description="Bu öğrenci için henüz gerçekleşmiş bir ödeme kaydı yok." />
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)] dark:border-slate-800 dark:bg-slate-900/60 dark:text-[var(--color-text-muted)]">
          <tr>
            <th className="px-4 py-3">Dönem / açıklama</th>
            <th className="px-4 py-3">Vade</th>
            <th className="px-4 py-3">Toplam</th>
            <th className="px-4 py-3">Ödenen</th>
            <th className="px-4 py-3">Kalan</th>
            <th className="px-4 py-3">Yöntem</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3">Makbuz</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800">
              <td className="px-4 py-3 font-medium text-[var(--color-text)] dark:text-slate-50">
                {p.description}
                {p.lessonId ? (
                  <Link
                    href={`/panel/program?studentId=${p.studentId}`}
                    className="mt-0.5 block text-xs font-normal text-amber-700 hover:underline"
                  >
                    Kaynak ders →
                  </Link>
                ) : null}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{formatDate(p.dueDate)}</td>
              <td className="px-4 py-3">{formatMoney(p.amount)}</td>
              <td className="px-4 py-3">{formatMoney(p.paidAmount)}</td>
              <td className="px-4 py-3 font-medium">{formatMoney(Math.max(p.amount - p.paidAmount, 0))}</td>
              <td className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{p.method ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge status={p.status} />
              </td>
              <td className="px-4 py-3">
                {p.status === "paid" ? (
                  <Link
                    href={`/makbuz/${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    <Receipt className="h-3.5 w-3.5" /> Görüntüle
                  </Link>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </Card>
  );
}
