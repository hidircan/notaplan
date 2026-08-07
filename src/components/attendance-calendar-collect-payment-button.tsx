"use client";

/**
 * Yoklama Takvimi gün kutusundan tahsilat — TEK finansal gerçek kaynağı
 * (Payment) hiç dallandırmadan, Ödemeler ekranının "Ödendi işaretle" ile
 * BİREBİR AYNI uç noktayı (`POST /api/v1/payments/:paymentId/pay` →
 * createPaymentTool → markPaymentPaid) çağırır — yeni/paralel bir tahsilat
 * yolu YOK. Bu uç nokta zaten:
 *   - RBAC'i (yalnızca `payments:write` izni olan roller — SCHOOL_ADMIN/
 *     SUPER_ADMIN) sunucu tarafında kesin olarak uygular,
 *   - "Tüm kurumlar" (merged) görünümünde yazmayı FORBIDDEN ile reddeder
 *     (resolveWriteScope) — tenant izolasyonu burada YENİDEN yazılmaz,
 *   - audit log'a "payments.pay" olarak yazar (auditLog + audit(payment.mark_paid)),
 *   - iptal edilmiş (voided) bir tahsilatı zaten `status !== "voided"` filtre
 *     ile bu bileşene hiç ulaştırmaz (bkz. attendance-calendar-panel.tsx).
 * Çift tahsilat: buton yalnızca `status !== "paid" && status !== "voided"`
 * iken render edilir (çağıran taraf), başarılı istekten sonra ay verisi
 * tazelenip status "paid" olur — buton bir daha render edilmez (idempotent
 * UI); art arda tıklamaya karşı `pending` durumunda buton disabled'dır.
 */

import { useState, useTransition } from "react";

export function AttendanceCalendarCollectPaymentButton({
  paymentId,
  lessonId,
  onSettled,
}: {
  paymentId: string;
  lessonId: string;
  onSettled: (lessonId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onCollect() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/payments/${paymentId}/pay`, { method: "POST" });
        const json = (await res.json()) as { ok: boolean; error?: { message: string } };
        if (!json.ok) {
          setError(json.error?.message || "Tahsilat alınamadı.");
          return;
        }
      } catch {
        setError("Bağlantı hatası. Tekrar deneyin.");
      } finally {
        onSettled(lessonId);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={onCollect}
        className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
      >
        {pending ? "İşleniyor…" : "Tahsil Et"}
      </button>
      {error ? (
        <p className="mt-1 font-medium text-[#8b3a3a]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
