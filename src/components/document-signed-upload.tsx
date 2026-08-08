"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

/**
 * İmzalı/taranmış sürüm yükleme — status "uploaded" olur. Zaten bir sürüm
 * varsa (`hasExisting`) da tekrar çağrılabilir: ÜZERİNE YAZMAZ, yeni bir
 * sürüm geçmişi kaydı ekler (bkz. documents/index.ts uploadSignedDocumentFile).
 */
export function DocumentSignedUpload({
  documentId,
  hasExisting = false,
}: {
  documentId: string;
  hasExisting?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fileData = await readFileAsBase64(file);
      const res = await fetch(`/api/v1/documents/${documentId}/upload-signed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileMimeType: file.type || "application/octet-stream", fileData }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Yüklenemedi");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(e) => void onUpload(e)}
        className="hidden"
        aria-label="İmzalı sürüm yükle"
      />
      <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? "Yükleniyor…" : hasExisting ? "Yeni Sürüm Yükle" : "İmzalı Sürüm Yükle"}
      </Button>
      {error ? (
        <p className="mt-1 text-xs font-medium text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
