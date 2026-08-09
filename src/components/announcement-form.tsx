"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { STUDENT_TYPES, type AnnouncementAudienceType } from "@/lib/types";

type BranchOption = { id: string; shortName: string };

const AUDIENCE_LABELS: Record<AnnouncementAudienceType, string> = {
  all: "Herkes",
  branch: "Belirli bir şube",
  teachers: "Yalnızca öğretmenler",
  parents: "Yalnızca veliler",
  students: "Yalnızca öğrenciler",
  studentType: "Belirli bir öğrenci türü",
  selected: "Seçili kullanıcılar (userId listesi)",
};

export function AnnouncementForm({ branches }: { branches: BranchOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AnnouncementAudienceType>("all");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [studentType, setStudentType] = useState(STUDENT_TYPES[0]);
  const [userIdsText, setUserIdsText] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    let audienceRef: Record<string, unknown> | undefined;
    if (audienceType === "branch") audienceRef = { branchId };
    if (audienceType === "studentType") audienceRef = { studentType };
    if (audienceType === "selected") {
      audienceRef = {
        userIds: userIdsText
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }

    try {
      const res = await fetch("/api/v1/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          audienceType,
          audienceRef,
          status: publishNow ? "published" : "draft",
          pinned,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message || "Duyuru oluşturulamadı.");
        setBusy(false);
        return;
      }
      setTitle("");
      setBody("");
      setUserIdsText("");
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Başlık</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] outline-none ring-amber-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">İçerik</label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          rows={3}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] outline-none ring-amber-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Hedef kitle</label>
          <select
            value={audienceType}
            onChange={(event) => setAudienceType(event.target.value as AnnouncementAudienceType)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] outline-none ring-amber-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {(Object.keys(AUDIENCE_LABELS) as AnnouncementAudienceType[]).map((key) => (
              <option key={key} value={key}>
                {AUDIENCE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        {audienceType === "branch" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">Şube</label>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] outline-none ring-amber-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.shortName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {audienceType === "studentType" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
              Öğrenci türü
            </label>
            <select
              value={studentType}
              onChange={(event) => setStudentType(event.target.value as typeof studentType)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] outline-none ring-amber-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {STUDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {audienceType === "selected" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
            Kullanıcı ID listesi (virgül veya satırla ayırın)
          </label>
          <textarea
            value={userIdsText}
            onChange={(event) => setUserIdsText(event.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] outline-none ring-amber-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] dark:text-slate-300">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(event) => setPublishNow(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Hemen yayınla
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] dark:text-slate-300">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(event) => setPinned(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Sabitle (listenin başında göster)
        </label>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Oluşturuluyor..." : "Duyuru oluştur"}
      </Button>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </form>
  );
}
