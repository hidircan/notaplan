"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Label, Select } from "@/components/ui";

function randomKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function DocumentCreateForm({
  templates,
  students,
}: {
  templates: { id: string; name: string; kind: string }[];
  students: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRef, setLastRef] = useState<string | null>(null);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  // Aynı isteğin (ör. çift tıklama) duplicate belge üretmesini önlemek için
  // istemci-tarafı tekrar anahtarı — başarılı oluşturmadan sonra yenilenir.
  const idempotencyKeyRef = useRef(randomKey());

  async function createDoc() {
    setBusy(true);
    setError(null);
    setPrintHtml(null);
    try {
      const res = await fetch("/api/v1/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          studentId: studentId || undefined,
          fieldValues: {},
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { documentId: string; reference: string };
        error?: { message: string };
      };
      if (!json.ok || !json.data) {
        setError(json.error?.message || "Oluşturulamadı");
        setBusy(false);
        return;
      }
      setLastRef(json.data.reference);
      idempotencyKeyRef.current = randomKey();
      const printRes = await fetch(`/api/v1/documents/${json.data.documentId}/print`, {
        method: "POST",
      });
      const printJson = (await printRes.json()) as {
        ok: boolean;
        data?: { html?: string; reference: string; printCount: number };
      };
      if (printJson.ok && printJson.data?.html) {
        setPrintHtml(printJson.data.html);
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Şablon</Label>
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Öğrenci (bağlam)</Label>
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {lastRef ? (
        <p className="text-xs font-medium text-emerald-700">Referans: {lastRef} (yeniden basımda korunur)</p>
      ) : null}
      <Button type="button" disabled={busy || !templateId} onClick={() => void createDoc()}>
        {busy ? "İşleniyor…" : "Oluştur ve yazdır"}
      </Button>
      {printHtml ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 prose prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: printHtml }} />
        </div>
      ) : null}
    </div>
  );
}
