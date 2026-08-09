"use client";

/**
 * Evraklar — şablon yönetimi (oluştur/düzenle/arşivle). Yeni REST uçlarını
 * (`/api/v1/documents/templates`) kullanır — `createDocumentTemplateTool`/
 * `updateDocumentTemplateTool`/`archiveDocumentTemplateTool` sunucuda
 * `bodyHtml`'i sanitize eder (script/iframe/event handler/javascript: URL
 * elenir); bu bileşen yalnızca formu sunar, güvenlik sınırı sunucudadır.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "student_enrollment_contract", label: "Öğrenci Kayıt Sözleşmesi" },
  { value: "parent_social_media_consent", label: "Veli / Sosyal Medya İzni" },
  { value: "kvkk", label: "KVKK" },
  { value: "teacher_contract", label: "Öğretmen Sözleşmesi" },
  { value: "teacher_info_form", label: "Öğretmen Bilgi Formu" },
  { value: "trial_form", label: "Deneme Formu" },
  { value: "makeup_request", label: "Telafi Talebi" },
  { value: "payment_commitment", label: "Ödeme Taahhüdü" },
  { value: "petition", label: "Dilekçe" },
  { value: "custom", label: "Özel Şablon" },
];

const PLACEHOLDER_HELP =
  "Kullanılabilir alanlar: {{document.referenceNumber}}, {{document.createdAt}}, {{institution.name}}, {{institution.address}}, {{student.fullName}}, {{student.birthDate}}, {{parent.fullName}}, {{parent.phone}}, {{teacher.fullName}}, {{currentDate}}";

export type TemplateRow = {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  version: number;
  updatedAt: string;
};

export function DocumentTemplateManager({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState(KIND_OPTIONS[0]!.value);
  const [bodyHtml, setBodyHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setBodyHtml("");
    setKind(KIND_OPTIONS[0]!.value);
    setError(null);
  }

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const res = editingId
        ? await fetch(`/api/v1/documents/templates/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, ...(bodyHtml ? { bodyHtml } : {}) }),
          })
        : await fetch("/api/v1/documents/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, kind, bodyHtml }),
          });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Kaydedilemedi.");
        return;
      }
      resetForm();
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(id: string, nextActive: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/documents/templates/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "İşlem başarısız.");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
            <div>
              <span className="font-medium text-[var(--color-text)]">{t.name}</span>{" "}
              <span className="text-xs text-[var(--color-text-muted)]">
                ({KIND_OPTIONS.find((k) => k.value === t.kind)?.label ?? t.kind} · v{t.version}
                {!t.active ? " · Arşivlendi" : ""})
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingId(t.id);
                  setName(t.name);
                  setKind(t.kind);
                  setBodyHtml("");
                  setShowForm(true);
                }}
                className="text-[var(--color-primary)] hover:underline"
              >
                Düzenle
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onToggleActive(t.id, !t.active)}
                className={t.active ? "text-rose-600 hover:underline" : "text-emerald-700 hover:underline"}
              >
                {t.active ? "Arşivle" : "Geri Aç"}
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">Henüz şablon yok.</p> : null}
      </div>

      {showForm ? (
        <div className="space-y-2 rounded-md border border-dashed border-slate-300 p-3">
          <div>
            <Label>Başlık</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Kayıt Sözleşmesi v2" />
          </div>
          {!editingId ? (
            <div>
              <Label>Belge türü</Label>
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div>
            <Label>İçerik (HTML)</Label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={6}
              placeholder={editingId ? "Boş bırakılırsa mevcut içerik korunur…" : "<h1>Başlık</h1><p>{{student.fullName}}</p>"}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]/30"
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{PLACEHOLDER_HELP}</p>
            <p className="mt-1 text-[11px] text-amber-700">
              Kaydedilen içerik sunucuda otomatik temizlenir — script, iframe, event handler ve tehlikeli
              bağlantılar kaldırılır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" disabled={busy || !name || (!editingId && !bodyHtml)} onClick={() => void onSubmit()}>
              {busy ? "Kaydediliyor…" : editingId ? "Güncelle" : "Şablonu Oluştur"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setShowForm(true)}>
          Yeni Şablon
        </Button>
      )}
    </div>
  );
}
