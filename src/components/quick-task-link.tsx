import Link from "next/link";
import { ListChecks } from "lucide-react";

/**
 * Package E — bağlamdan hızlı görev oluşturma. İkinci bir görev sistemi
 * KURMAZ: mevcut `/panel/is-takip` sayfası zaten `newTask*` query param'ları
 * ile öğrenci/öğretmen/ders/ödeme/evrak/şube bağlamını okuyup formu
 * önceden dolduruyor ve kaydedince (Task.studentId/teacherId/... zaten var)
 * `task-detail-panel.tsx` "X'e git →" linkleriyle kaynağa geri dönüyor —
 * bu bileşen yalnızca o akışa giden linki üretir (RBAC/tenant kesin olarak
 * createTaskTool + validateTaskLinks'te uygulanır, burada tekrar edilmez).
 */
export function QuickTaskLink({
  context,
  label = "Görev Oluştur",
  returnTo,
  className,
}: {
  context: {
    studentId?: string;
    teacherId?: string;
    branchId?: string;
    lessonId?: string;
    paymentId?: string;
    documentId?: string;
  };
  label?: string;
  /** Görev kaydedildikten sonra "← Geri dön" ile döneceği yol (bkz. resolveSafeReturnTo). */
  returnTo?: string;
  className?: string;
}) {
  const params = new URLSearchParams();
  if (context.studentId) params.set("newTaskStudentId", context.studentId);
  if (context.teacherId) params.set("newTaskTeacherId", context.teacherId);
  if (context.branchId) params.set("newTaskBranchId", context.branchId);
  if (context.lessonId) params.set("newTaskLessonId", context.lessonId);
  if (context.paymentId) params.set("newTaskPaymentId", context.paymentId);
  if (context.documentId) params.set("newTaskDocumentId", context.documentId);
  if (returnTo) params.set("returnTo", returnTo);

  return (
    <Link
      href={`/panel/is-takip?${params.toString()}`}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
      }
    >
      <ListChecks className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Link>
  );
}
