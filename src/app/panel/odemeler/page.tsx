import { actionMarkPaymentPaid } from "@/lib/actions";
import { readData } from "@/lib/store";
import { Badge, Button, Card, PageHeader, StatCard } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OdemelerPage() {
  const data = await readData();
  const payments = [...data.payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const collected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.paidAmount, 0);
  const outstanding = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const overdue = payments.filter((p) => p.status === "overdue").length;

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
            {payments.map((p) => {
              const student = data.students.find((s) => s.id === p.studentId);
              return (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{student?.name}</td>
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
                      <span className="text-xs text-emerald-600">✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
