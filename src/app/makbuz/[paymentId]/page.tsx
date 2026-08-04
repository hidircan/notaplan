import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionContext, homePathForRole } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { buildReceiptViewModel, canViewReceipt, receiptIneligibleReason } from "@/lib/receipt";
import { formatDate, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { ReceiptActions } from "@/components/receipt-actions";

export const dynamic = "force-dynamic";

function NoticeScreen({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <Link
        href={backHref}
        className="mt-6 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
      >
        {backLabel}
      </Link>
    </div>
  );
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;

  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/makbuz/${paymentId}`);
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect(homePathForRole(session.role));
  }

  const data = await readData();
  const payment = data.payments.find((p) => p.id === paymentId);

  if (!payment) {
    return (
      <NoticeScreen
        title="Ödeme kaydı bulunamadı."
        description="Bu ödeme silinmiş olabilir veya kurumunuza ait değil."
        backHref="/panel/odemeler"
        backLabel="Ödemelere dön"
      />
    );
  }

  const student = data.students.find((s) => s.id === payment.studentId);
  const backHref = student ? `/panel/odemeler/${student.id}` : "/panel/odemeler";

  if (!canViewReceipt(payment)) {
    return (
      <NoticeScreen
        title="Makbuz henüz oluşturulamıyor."
        description={receiptIneligibleReason(payment) ?? "Bu ödeme için makbuz görüntülenemiyor."}
        backHref={backHref}
        backLabel="Geri dön"
      />
    );
  }

  if (!student) {
    return (
      <NoticeScreen
        title="Makbuz oluşturulamadı."
        description="Bu ödemeye bağlı öğrenci kaydı bulunamadı."
        backHref="/panel/odemeler"
        backLabel="Ödemelere dön"
      />
    );
  }

  const branch = data.settings.branches.find((b) => b.id === student.branchId);
  const model = buildReceiptViewModel(payment, student, data.settings, branch);
  const issuedAtIso = new Date().toISOString();

  return (
    <div className="min-h-screen bg-[#f4f2f8] px-4 py-8 print:bg-white print:p-0 sm:px-6">
      <style>{"@media print { @page { size: A4; margin: 14mm; } }"}</style>
      <div className="mx-auto max-w-2xl">
        <ReceiptActions backHref={backHref} />

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
            <p className="text-lg font-semibold text-slate-900">Ödeme Makbuzu</p>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Referans</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-700">{model.reference}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Düzenlenme tarihi</p>
              <p className="mt-1 text-slate-800">{formatDate(issuedAtIso, "d MMMM yyyy")}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Ödeme tarihi</p>
              <p className="mt-1 text-slate-800">{formatDate(model.paymentDateIso, "d MMMM yyyy")}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Öğrenci</p>
            <p className="mt-1 truncate text-base font-semibold text-slate-900">{model.studentName}</p>
            {model.parentLine ? (
              <p className="mt-0.5 truncate text-slate-500">Veli: {model.parentLine}</p>
            ) : null}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Açıklama</p>
                <p className="mt-1 truncate text-slate-800">{model.description}</p>
                {model.method ? (
                  <p className="mt-1 text-xs text-slate-400">Yöntem: {model.method}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Tahsil edilen tutar
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoney(model.amount)}</p>
                <div className="mt-1 flex justify-end">
                  <Badge status="paid" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex border-t border-slate-100 pt-10 print:break-inside-avoid">
            <div className="min-w-[220px] max-w-xs flex-1">
              <div className="h-16 border-b border-slate-400" />
              <p className="mt-2 text-center text-xs font-medium text-slate-600">
                Teslim Eden
              </p>
            </div>
          </div>

          <p className="mt-10 text-center text-[11px] text-slate-400">
            Bu makbuz sistem tarafından oluşturulmuştur.
          </p>
        </div>
      </div>
    </div>
  );
}
