import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { actionAddPayment } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Button, Input, Label, PageHeader, Select, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { PaymentsTable, type PaymentRow } from "@/components/payments-table";

export const dynamic = "force-dynamic";

export default async function OdemelerPage() {
  const data = await readData();
  const payments = [...data.payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const collected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.paidAmount, 0);
  const outstanding = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const overdue = payments.filter((p) => p.status === "overdue").length;

  const rows: PaymentRow[] = payments.map((p) => ({
    id: p.id,
    studentName: data.students.find((s) => s.id === p.studentId)?.name ?? "",
    description: p.description,
    method: p.method,
    dueDate: p.dueDate,
    amount: p.amount,
    paidAmount: p.paidAmount,
    status: p.status,
  }));

  return (
    <div>
      <PageHeader
        title="Ödemeler"
        description="Aylık paket tahsilatı, gecikmeler ve kısmi ödemeler."
        actions={
          <Link
            href="/panel/ai/tahsilat-agent"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Tahsilat takibini aç <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tahsil edilen" value={formatMoney(collected)} accent="emerald" />
        <StatCard label="Bekleyen" value={formatMoney(outstanding)} accent="amber" />
        <StatCard label="Gecikmiş adet" value={overdue} accent="rose" />
      </div>

      <details className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Yeni ödeme kaydı ekle
        </summary>
        <form action={actionAddPayment} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Öğrenci</Label>
            <Select name="studentId" defaultValue={data.students.find((s) => s.active)?.id}>
              {data.students
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Açıklama / dönem</Label>
            <Input name="description" required placeholder="Örn. Ağustos 2026 — Piyano" />
          </div>
          <div>
            <Label>Tutar (₺)</Label>
            <Input name="amount" type="number" min={1} defaultValue={3000} required />
          </div>
          <div>
            <Label>Vade tarihi</Label>
            <Input name="dueDate" type="date" required />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">Ödeme kaydı ekle</Button>
          </div>
        </form>
      </details>

      <PaymentsTable rows={rows} />
    </div>
  );
}
