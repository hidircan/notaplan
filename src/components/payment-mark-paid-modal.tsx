"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { actionMarkPaymentPaidDetailed, actionUpdatePayment } from "@/lib/actions";

type PaymentMethod = "credit_card" | "cash" | "transfer";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "transfer", label: "Havale/EFT" },
  { value: "credit_card", label: "Kredi Kartı" },
  { value: "cash", label: "Nakit" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentMarkPaidModal({
  paymentId,
  studentName,
  defaultAmount,
  mode,
  initialMethod,
  initialNote,
  onClose,
}: {
  paymentId: string;
  studentName: string;
  defaultAmount: number;
  /** "create" — henüz ödenmemiş kaydı ödendi işaretler; "edit" — zaten ödenmiş kaydı düzenler. */
  mode: "create" | "edit";
  initialMethod?: PaymentMethod;
  initialNote?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [method, setMethod] = useState<PaymentMethod>(initialMethod ?? "transfer");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [paidAt, setPaidAt] = useState(todayIso());
  const [note, setNote] = useState(initialNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  function goToConfirm() {
    setError(null);
    if (!amountValid) {
      setError("Geçerli bir tutar girin.");
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const result =
      mode === "create"
        ? await actionMarkPaymentPaidDetailed({
            paymentId,
            method,
            amount: parsedAmount,
            paidAt,
            paymentNote: note.trim() || undefined,
          })
        : await actionUpdatePayment({
            paymentId,
            method,
            amount: parsedAmount,
            paymentNote: note.trim() || undefined,
          });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setStep("form");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-md)]"
      >
        {step === "form" ? (
          <>
            <h2 id={titleId} className="text-base font-semibold text-[var(--color-text)]">
              {mode === "create" ? "Ödendi işaretle" : "Ödemeyi düzenle"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{studentName}</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                  Ödeme yöntemi
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  {METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                  Tahsil edilen tutar (TL)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                />
              </div>

              {mode === "create" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                    Ödeme tarihi
                  </label>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                  Açıklama / referans (isteğe bağlı)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Örn. dekont no, kim aldı"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                />
              </div>
            </div>

            {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={goToConfirm}
                className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
              >
                Devam et
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className="text-base font-semibold text-[var(--color-text)]">
              Ödemeyi kaydetmek istediğinize emin misiniz?
            </h2>
            <div className="mt-3 space-y-1 rounded-lg bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text)]">
              <p>
                <span className="text-[var(--color-text-muted)]">Öğrenci:</span> {studentName}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Tutar:</span>{" "}
                {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(parsedAmount)}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Yöntem:</span>{" "}
                {METHOD_OPTIONS.find((o) => o.value === method)?.label}
              </p>
              {note.trim() ? (
                <p>
                  <span className="text-[var(--color-text-muted)]">Not:</span> {note.trim()}
                </p>
              ) : null}
            </div>
            {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={submitting}
                className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
              >
                Geri dön
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Kaydediliyor…" : "Evet, kaydet"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
