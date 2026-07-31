"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDollarSign, ExternalLink, PencilLine, Send } from "lucide-react";

function phoneToWa(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.startsWith("90")) return digits;
  return digits;
}

type FollowUpStatus = "draft" | "approved" | "sent" | "replied" | "paid" | "lost";

export function TahsilatMessageApproval({
  caseId,
  paymentId,
  studentId,
  amount,
  initialStatus,
  studentName,
  parentName,
  parentPhone,
  initialMessage,
}: {
  caseId?: string;
  paymentId: string;
  studentId: string;
  amount: number;
  initialStatus: FollowUpStatus;
  studentName: string;
  parentName: string;
  parentPhone: string;
  initialMessage: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<FollowUpStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waLink = useMemo(
    () => `https://wa.me/${phoneToWa(parentPhone)}?text=${encodeURIComponent(message)}`,
    [message, parentPhone]
  );
  const approved = status !== "draft";

  async function saveStatus(nextStatus: FollowUpStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/tahsilat/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: caseId,
          paymentId,
          studentId,
          status: nextStatus,
          messageDraft: message,
          attributedAmount: nextStatus === "paid" ? amount : 0,
        }),
      });
      if (res.ok) {
        setStatus(nextStatus);
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function markPaid() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/payments/${paymentId}/pay`, { method: "POST" });
      if (res.ok) {
        setStatus("paid");
        setSaved(true);
        router.refresh();
      } else {
        setError("Ödeme işaretlenemedi. Lütfen tekrar deneyin.");
      }
    } catch {
      setError("Ödeme işaretlenemedi. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel: Record<FollowUpStatus, string> = {
    draft: "Göndermeden önce onay gerekli",
    approved: "Onaylandı",
    sent: "Gönderildi",
    replied: "Yanıt alındı",
    paid: "Ödendi · ROI'ye eklendi",
    lost: "Kapatıldı (tahsil edilemedi)",
  };

  return (
    <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Veli mesajı · {parentName}</p>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${approved ? "text-emerald-700" : "text-amber-700"}`}>
          {approved && <CheckCircle2 className="h-4 w-4" />}
          {statusLabel[status]}{saved ? " ✓" : ""}
        </span>
      </div>
      {editing ? (
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2"
          aria-label={`${studentName} için veli mesajı`}
        />
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-sm leading-relaxed text-slate-600">{message}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <PencilLine className="h-4 w-4" /> {editing ? "Taslağı kaydet" : "Düzenle"}
        </button>
        {status === "draft" && (
          <button type="button" disabled={busy} onClick={() => void saveStatus("approved")} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Onayla
          </button>
        )}
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!approved}
          onClick={(event) => {
            if (!approved) { event.preventDefault(); return; }
            if (status === "approved") void saveStatus("sent");
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white ${approved ? "bg-emerald-600 hover:bg-emerald-700" : "cursor-not-allowed bg-slate-300"}`}
        >
          {approved ? <ExternalLink className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          WhatsApp&apos;ta aç
        </a>
        {status === "sent" || status === "replied" ? (
          <>
            {status === "sent" && (
              <button type="button" disabled={busy} onClick={() => void saveStatus("replied")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Yanıt alındı
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void markPaid()} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              <CircleDollarSign className="h-4 w-4" /> Ödendi işaretle
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
