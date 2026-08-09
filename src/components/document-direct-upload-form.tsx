"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Label, Select } from "@/components/ui";
import { DOCUMENT_TEMPLATE_KINDS, type DocumentTemplateKind } from "@/lib/types";

const KIND_LABELS: Record<DocumentTemplateKind, string> = {
  student_enrollment_contract: "Öğrenci Kayıt Sözleşmesi",
  parent_social_media_consent: "Veli / Sosyal Medya İzni",
  kvkk: "KVKK",
  teacher_contract: "Öğretmen Sözleşmesi",
  teacher_info_form: "Öğretmen Bilgi Formu",
  trial_form: "Deneme Formu",
  makeup_request: "Telafi Talebi",
  payment_commitment: "Ödeme Taahhüdü",
  petition: "Dilekçe",
  custom: "Diğer / Genel",
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

/**
 * Evraklar — şablon doldurmadan doğrudan kategori seçip dosya yükleme.
 * "Yeni Evrak Oluştur" (şablon-tabanlı) akışından AYRI, bilinçli olarak
 * daha basit: yalnız kategori + dosya. İndirme zaten belge detay
 * sayfasında (kategoriye göre filtrelenebilen listeden erişilir).
 */
export function DocumentDirectUploadForm({
  students,
  teachers,
}: {
  students: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<DocumentTemplateKind>("custom");
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Bir dosya seçin.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const fileData = await readFileAsBase64(file);
      const res = await fetch("/api/v1/documents/upload-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          fileName: file.name,
          fileMimeType: file.type || "application/octet-stream",
          fileData,
          studentId: studentId || undefined,
          teacherId: teacherId || undefined,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Dosya yüklenemedi.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      setFile(null);
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Kategori</Label>
        <Select value={kind} onChange={(e) => setKind(e.target.value as DocumentTemplateKind)}>
          {DOCUMENT_TEMPLATE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Öğrenci (opsiyonel)</Label>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">—</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Öğretmen (opsiyonel)</Label>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">—</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Dosya</Label>
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-[var(--color-text-muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">PDF, PNG, JPEG veya WEBP — en fazla 2MB.</p>
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="text-xs font-medium text-emerald-600">Dosya yüklendi.</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Yükleniyor…" : "Dosyayı yükle"}
      </Button>
    </form>
  );
}
