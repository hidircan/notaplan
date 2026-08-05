import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { readData } from "@/lib/store";
import { EmptyState, PageHeader } from "@/components/ui";
import { TeacherPayoutHistory } from "@/components/teacher-payout-history";
import { AssistantPageContext } from "@/components/ai/assistant-page-context";

export const dynamic = "force-dynamic";

export default async function TeacherPayoutHistoryPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;

  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect(`/login?next=/panel/ogretmenler/${teacherId}/odemeler`);
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const data = await readData();
  const teacher = data.teachers.find((t) => t.id === teacherId);

  if (!teacher) {
    return (
      <div>
        <PageHeader title="Ödeme geçmişi" description="Öğretmen bulunamadı." />
        <EmptyState
          title="Öğretmen bulunamadı"
          description="Bu öğretmen kurumunuza kayıtlı değil veya kaldırılmış olabilir."
        />
        <Link
          href="/panel/ogretmenler"
          className="mt-4 inline-block text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          Öğretmenlere dön
        </Link>
      </div>
    );
  }

  const payouts = data.teacherPayouts.filter((p) => p.teacherId === teacherId);

  return (
    <div>
      <AssistantPageContext entity={{ kind: "teacher", id: teacher.id, label: teacher.name }} />
      <PageHeader
        title={`${teacher.name} — Ödeme Geçmişi`}
        description="Bekleyen ve tamamlanmış hakediş ödemeleri."
        actions={
          <Link
            href={`/panel/ogretmenler/${teacherId}/hakedis`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hakediş dökümüne dön
          </Link>
        }
      />
      <TeacherPayoutHistory payouts={payouts} />
    </div>
  );
}
