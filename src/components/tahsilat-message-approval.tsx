"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDollarSign, ExternalLink, PencilLine, Send, Sparkles, XCircle } from "lucide-react";
import { useCollectionsAI } from "@/hooks/useCollectionsAI";

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
  canWrite,
  tenantId,
  canUseAiDraft,
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
  /** "Tüm kurumlar" görünümünde false — mesaj/ödeme durumu değiştirilemez. */
  canWrite: boolean;
  /** AI taslak oluşturma isteğinin oturumu izlemesi için — auth parametresi değil. */
  tenantId: string;
  /** `collectionsMessageDraft` capability'sinin `allowedRoles`'ı ile birebir —
   * sunucu zaten 403 döner, ama UI'da da butonu göstermemek gerekir
   * (rol bazlı görünürlük yalnız sunucuda bırakılmaz). */
  canUseAiDraft: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<FollowUpStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ai = useCollectionsAI(tenantId);
  const hasPhone = parentPhone.trim().length > 0;
  const waLink = useMemo(
    () => (hasPhone ? `https://wa.me/${phoneToWa(parentPhone)}?text=${encodeURIComponent(message)}` : null),
    [hasPhone, message, parentPhone]
  );
  const hasCase = Boolean(caseId);
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
      } else {
        setError("İşlem kaydedilemedi. Lütfen tekrar deneyin.");
      }
    } catch {
      setError("İşlem kaydedilemedi. Lütfen tekrar deneyin.");
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

  function markLost() {
    if (busy) return;
    if (!window.confirm("Bu takip sonuçsuz kapatılacak. Ödeme kaydı etkilenmez, istediğiniz zaman yeniden takip başlatabilirsiniz. Devam edilsin mi?")) {
      return;
    }
    void saveStatus("lost");
  }

  const statusLabel: Record<FollowUpStatus, string> = {
    draft: "Taslak · henüz takip başlatılmadı",
    approved: "Onaylandı · gönderime hazır",
    sent: "Sistemde gönderildi olarak kaydedildi",
    replied: "Yanıt alındı · ödeme sözü takip ediliyor",
    paid: "Ödendi · ROI'ye eklendi",
    lost: "Sonuçsuz kapatıldı",
  };
  const isTerminal = status === "paid" || status === "lost";

  return (
    <div className="mt-3 rounded-xl border border-amber-100 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Veli mesajı · {parentName}</p>
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold ${
            status === "paid" ? "text-emerald-700" : status === "lost" ? "text-slate-500" : approved ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {approved && !isTerminal && <CheckCircle2 className="h-4 w-4" />}
          {status === "lost" && <XCircle className="h-4 w-4" />}
          {statusLabel[status]}
          {saved ? " ✓" : ""}
        </span>
      </div>

      {isTerminal ? (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {message}
        </p>
      ) : editing ? (
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-700 outline-none ring-amber-200 focus:ring-2"
          aria-label={`${studentName} için veli mesajı`}
        />
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{message}</p>
      )}

      {isTerminal ? (
        status === "lost" ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Bu takip sonuçsuz kapatıldı. Ödeme hâlâ bekliyorsa aşağıdaki &quot;Ödemeyi görüntüle&quot;
            bağlantısından yeniden takip başlatabilirsiniz.
          </p>
        ) : null
      ) : !canWrite ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          &quot;Tüm kurumlar&quot; görünümündesiniz — mesaj gönderme/onaylama için üstteki kurum
          seçiciden tek bir kurum seçin.
        </p>
      ) : (
        <>
          {status === "draft" && canUseAiDraft ? (
            <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-white p-2.5 dark:border-amber-800 dark:bg-slate-900">
              <button
                type="button"
                disabled={ai.isLoading}
                onClick={() =>
                  void ai.generateDraft({ studentName, parentName, amount }).catch(() => {})
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {ai.isLoading ? "AI taslak hazırlıyor..." : "AI ile taslak oluştur"}
              </button>
              {ai.error ? <p className="mt-1.5 text-xs font-medium text-rose-600">{ai.error}</p> : null}
              {ai.draft && ai.status === "pending_approval" ? (
                <div className="mt-2 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/30">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    AI taslağı · onayınız gerekiyor
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{ai.draft.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={ai.isLoading}
                      onClick={() => {
                        const draftText = ai.draft?.text;
                        void ai.approveDraft(ai.draft!.invocationId).then(() => {
                          if (draftText) setMessage(draftText);
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Kullan
                    </button>
                    <button
                      type="button"
                      disabled={ai.isLoading}
                      onClick={() => void ai.rejectDraft(ai.draft!.invocationId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : ai.status === "rejected" ? (
                <p className="mt-1.5 text-xs text-slate-400">AI taslağı reddedildi — mevcut metin korunuyor.</p>
              ) : ai.status === "approved" ? (
                <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  AI taslağı kullanıldı — aşağıdaki metni düzenleyip onaylayabilirsiniz.
                </p>
              ) : null}
            </div>
          ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <PencilLine className="h-4 w-4" /> {editing ? "Taslağı kaydet" : "Düzenle"}
          </button>
          {status === "draft" && (
            <button type="button" disabled={busy} onClick={() => void saveStatus("approved")} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> {hasCase ? "Onayla" : "Takip başlat"}
            </button>
          )}
          {approved && hasPhone ? (
            <a
              href={waLink ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <ExternalLink className="h-4 w-4" />
              WhatsApp&apos;ta aç
            </a>
          ) : approved ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Send className="h-4 w-4" /> Veli telefonu eksik — WhatsApp linki oluşturulamıyor
            </span>
          ) : null}
          {status === "approved" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveStatus("sent")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Sistemde gönderildi olarak kaydet
            </button>
          )}
          {status === "sent" || status === "replied" ? (
            <>
              {status === "sent" && (
                <button type="button" disabled={busy} onClick={() => void saveStatus("replied")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  Yanıt alındı / ödeme sözü verildi
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => void markPaid()} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <CircleDollarSign className="h-4 w-4" /> Ödendi işaretle
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={markLost}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Sonuçsuz kapat
              </button>
            </>
          ) : null}
          </div>
        </>
      )}
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
