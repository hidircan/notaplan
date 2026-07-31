import { readData } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/ui";
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
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tahsil edilen" value={formatMoney(collected)} accent="emerald" />
        <StatCard label="Bekleyen" value={formatMoney(outstanding)} accent="amber" />
        <StatCard label="Gecikmiş adet" value={overdue} accent="rose" />
      </div>

      <PaymentsTable rows={rows} />
    </div>
  );
}
