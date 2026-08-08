"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/utils";

export type SignedVersionRow = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  deletedAt?: string;
  /** Bu sürüm şu an güncel (indirilen) sürüm mü — yalnızca görsel etiket için. */
  isCurrent: boolean;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** İmzalı sürüm geçmişi — soft-delete edilenler "Kaldırıldı" olarak işaretli kalır (audit izi), listeden kaybolmaz. */
export function DocumentSignedVersions({ documentId, versions }: { documentId: string; versions: SignedVersionRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function onDelete(versionId: string) {
    setPendingId(versionId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/signed-versions/${versionId}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Kaldırılamadı.");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setPendingId(null);
    }
  }

  if (versions.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Henüz sürüm geçmişi yok.</p>;
  }

  return (
    <div className="space-y-1.5">
      {error ? (
        <p className="text-xs font-medium text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--color-bg)] p-2 text-xs"
        >
          <div className={v.deletedAt ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]"}>
            <span className="font-medium">{v.fileName}</span> · {formatSize(v.fileSize)} ·{" "}
            {formatDateTime(v.uploadedAt)}
            {v.isCurrent && !v.deletedAt ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Güncel
              </span>
            ) : null}
            {v.deletedAt ? <span className="ml-2 italic">Kaldırıldı</span> : null}
          </div>
          {!v.deletedAt ? (
            confirmId === v.id ? (
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-muted)]">Emin misiniz?</span>
                <button
                  type="button"
                  disabled={pendingId === v.id}
                  onClick={() => void onDelete(v.id)}
                  className="font-medium text-[var(--color-danger)] hover:underline"
                >
                  {pendingId === v.id ? "…" : "Evet, kaldır"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  className="font-medium text-[var(--color-text-muted)] hover:underline"
                >
                  Vazgeç
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmId(v.id)}
                className="font-medium text-[var(--color-danger)] hover:underline"
              >
                Kaldır
              </button>
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}
