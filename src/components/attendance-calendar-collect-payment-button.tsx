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

import { useId, useState, useTransition } from "react";
import type { StudentPaymentMethod } from "@/lib/types";

const PAYMENT_METHOD_OPTIONS: { value: StudentPaymentMethod; label: string }[] = [
  { value: "cash", label: "Nakit" },
  { value: "transfer", label: "Havale" },
  { value: "credit_card", label: "Kredi Kartı" },
];

export function AttendanceCalendarCollectPaymentButton({
  paymentId,
  lessonId,
  defaultMethod,
  onSettled,
}: {
  paymentId: string;
  lessonId: string;
  /**
   * Öğrencinin kayıtlı ödeme yöntemi (veya dersin zaten taşıdığı method) —
   * tool katmanından zaten `method ?? student.paymentMethod` olarak çözülüp
   * geliyor (bkz. getAttendanceCalendarMonthTool). Seçim kutusu ilk açılışta
   * bu değerle önceden doldurulur; kullanıcı değiştirmezse hiç `method`
   * gönderilmez ve backend AYNI varsayılan zinciri (`method ?? payment.method
   * ?? student.paymentMethod ?? "Havale"`) ile devam eder — mevcut güvenli
   * davranış korunur.
   */
  defaultMethod?: string;
  onSettled: (lessonId: string) => void;
}) {
  const selectId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initialMethod = PAYMENT_METHOD_OPTIONS.some((o) => o.value === defaultMethod)
    ? (defaultMethod as StudentPaymentMethod)
    : "";
  const [method, setMethod] = useState<StudentPaymentMethod | "">(initialMethod);

  function onCollect() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/payments/${paymentId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(method ? { method } : {}),
        });
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
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor={selectId} className="text-[11px] text-[var(--color-text-muted)]">
          Ödeme şekli
        </label>
        <select
          id={selectId}
          value={method}
          disabled={pending}
          onChange={(e) => setMethod(e.target.value as StudentPaymentMethod | "")}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-1 text-[11px] text-[var(--color-text)] disabled:opacity-50"
        >
          <option value="">Varsayılan</option>
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={onCollect}
          className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          {pending ? "İşleniyor…" : "Tahsil Et"}
        </button>
      </div>
      {error ? (
        <p className="font-medium text-[#8b3a3a]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
