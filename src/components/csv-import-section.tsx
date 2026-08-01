"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { Button, Card } from "@/components/ui";

type ImportRowError = { row: number; field: string; message: string };
type ImportPreview<T> = {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ImportRowError[];
  valid: T[];
};
type ImportCommitResult = { created: number; updated: number };

type PreviewActionResult<T> = { ok: true; preview: ImportPreview<T> } | { ok: false; message: string };
type CommitActionResult = { ok: true; result: ImportCommitResult } | { ok: false; message: string };

export function CsvImportSection<T,>({
  title,
  description,
  columns,
  sampleCsv,
  sampleFileName,
  onPreview,
  onCommit,
}: {
  title: string;
  description: string;
  columns: readonly string[];
  sampleCsv: string;
  sampleFileName: string;
  onPreview: (csvText: string) => Promise<PreviewActionResult<T>>;
  onCommit: (csvText: string) => Promise<CommitActionResult>;
}) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<ImportCommitResult | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    setPreview(null);
    setError(null);
    setCommitSuccess(null);
  }

  async function handlePreview() {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    const result = await onPreview(csvText);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview(result.preview);
  }

  async function handleCommit() {
    if (!csvText) return;
    setCommitting(true);
    setError(null);
    const result = await onCommit(csvText);
    setCommitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCommitSuccess(result.result);
    setPreview(null);
    setCsvText(null);
    setFileName(null);
  }

  const downloadHref = `data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
          <p className="mt-1 text-xs text-slate-400">Sütunlar: {columns.join(", ")}</p>
        </div>
        <a
          href={downloadHref}
          download={sampleFileName}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          <Download className="h-4 w-4" /> Örnek CSV indir
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          aria-label={`${title} CSV dosyası seç`}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <Button type="button" variant="secondary" onClick={handlePreview} disabled={!csvText || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Önizle
        </Button>
        {preview ? (
          <Button
            type="button"
            onClick={handleCommit}
            disabled={preview.errorCount > 0 || preview.validCount === 0 || committing}
          >
            {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {preview.validCount} kaydı içe aktar
          </Button>
        ) : null}
      </div>

      {fileName ? <p className="mt-2 text-xs text-slate-400">Seçilen dosya: {fileName}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      {preview ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-700">
            Toplam {preview.totalRows} satır · Geçerli {preview.validCount} · Hatalı {preview.errorCount}
          </p>
          {preview.errorCount > 0 ? (
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
              {preview.errors.map((e, i) => (
                <p key={i}>
                  Satır {e.row} · {e.field}: {e.message}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-emerald-600">Hata yok — içe aktarmaya hazır.</p>
          )}
        </div>
      ) : null}

      {commitSuccess ? (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {commitSuccess.created} kayıt eklendi, {commitSuccess.updated} kayıt güncellendi.{" "}
          <Link href="/panel/kurulum" className="font-medium underline">
            Kurulum Merkezi&apos;ne dön
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
