"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Label, Select } from "@/components/ui";

function randomKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Evrak Faz 3 — bağlam öğrenci VEYA öğretmen olabilir (ikisi birden değil;
 * `createDocumentInstanceSchema` ikisini de kabul eder ama şablonların çoğu
 * tek bir kişi tipine hitap eder). `defaultStudentId`/`defaultTeacherId`
 * verilmişse (bkz. Öğrenci/Öğretmen detay sayfalarındaki "Evrak Oluştur"
 * linkleri, `?studentId=`/`?teacherId=`) o bağlam ÖN SEÇİLİR — kullanıcı iki
 * ayrı listede tekrar arama yapmak zorunda kalmaz.
 */
export function DocumentCreateForm({
  templates,
  students,
  teachers,
  defaultStudentId,
  defaultTeacherId,
}: {
  templates: { id: string; name: string; kind: string }[];
  students: { id: string; name: string }[];
  teachers?: { id: string; name: string }[];
  defaultStudentId?: string;
  defaultTeacherId?: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [contextType, setContextType] = useState<"student" | "teacher">(
    defaultTeacherId && !defaultStudentId ? "teacher" : "student"
  );
  const [studentId, setStudentId] = useState(defaultStudentId ?? students[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(defaultTeacherId ?? teachers?.[0]?.id ?? "");
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
          studentId: contextType === "student" ? studentId || undefined : undefined,
          teacherId: contextType === "teacher" ? teacherId || undefined : undefined,
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
      {teachers && teachers.length > 0 ? (
        <div>
          <Label>Bağlam türü</Label>
          <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5" role="group">
            <button
              type="button"
              aria-pressed={contextType === "student"}
              onClick={() => setContextType("student")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                contextType === "student" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"
              }`}
            >
              Öğrenci
            </button>
            <button
              type="button"
              aria-pressed={contextType === "teacher"}
              onClick={() => setContextType("teacher")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                contextType === "teacher" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"
              }`}
            >
              Öğretmen
            </button>
          </div>
        </div>
      ) : null}
      {contextType === "student" ? (
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
      ) : (
        <div>
          <Label>Öğretmen (bağlam)</Label>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {(teachers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      )}
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
