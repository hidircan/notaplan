"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export type DocumentRow = {
  id: string;
  reference: string;
  kindLabel: string;
  personName: string;
  /** Öğrenciyle ilişkiliyse veli adı — arama alanına dahil edilir (kural A: "veli adı" ile arama). */
  parentName?: string;
  branchName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
}

export function DocumentsTable({ rows }: { rows: DocumentRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [archiving, setArchiving] = useState<string | null>(null);

  const search = searchParams.get("q") ?? "";
  const kindFilter = searchParams.getAll("kind");
  const statusFilter = searchParams.getAll("status");
  const branchFilter = searchParams.getAll("branch");
  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";

  function setDateParam(key: "from" | "to", value: string) {
    updateParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  }

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setSearch(value: string) {
    updateParams((params) => {
      if (value) params.set("q", value);
      else params.delete("q");
    });
  }

  function toggleMulti(key: string, value: string, current: string[]) {
    updateParams((params) => {
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      params.delete(key);
      next.forEach((v) => params.append(key, v));
    });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  async function onArchive(id: string) {
    setArchiving(id);
    try {
      await fetch(`/api/v1/documents/${id}/archive`, { method: "POST" });
      router.refresh();
    } finally {
      setArchiving(null);
    }
  }

  const kindOptions = useMemo(() => uniqueSorted(rows.map((r) => r.kindLabel)), [rows]);
  const statusOptions = useMemo(() => uniqueSorted(rows.map((r) => r.status)), [rows]);
  const branchOptions = useMemo(() => uniqueSorted(rows.map((r) => r.branchName ?? "")), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        query &&
        !r.reference.toLowerCase().includes(query) &&
        !r.personName.toLowerCase().includes(query) &&
        !(r.parentName ?? "").toLowerCase().includes(query)
      )
        return false;
      if (kindFilter.length && !kindFilter.includes(r.kindLabel)) return false;
      if (statusFilter.length && !statusFilter.includes(r.status)) return false;
      if (branchFilter.length && !(r.branchName && branchFilter.includes(r.branchName))) return false;
      if (fromDate && r.createdAt.slice(0, 10) < fromDate) return false;
      if (toDate && r.createdAt.slice(0, 10) > toDate) return false;
      return true;
    });
  }, [rows, search, kindFilter, statusFilter, branchFilter, fromDate, toDate]);

  const anyFilterActive =
    Boolean(search) || kindFilter.length > 0 || statusFilter.length > 0 || branchFilter.length > 0 || Boolean(fromDate) || Boolean(toDate);

  return (
    <>
      <Card className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Referans, başlık, öğrenci veya veli adı ara..."
            aria-label="Referans, başlık, öğrenci veya veli adı ara"
            className="w-full max-w-xs rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]/30 sm:w-auto"
          />
          {anyFilterActive ? (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
            >
              Filtreleri Temizle
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterChips label="Evrak türü" options={kindOptions} selected={kindFilter} onToggle={(v) => toggleMulti("kind", v, kindFilter)} />
          <FilterChips label="Durum" options={statusOptions} selected={statusFilter} onToggle={(v) => toggleMulti("status", v, statusFilter)} />
          <FilterChips label="Şube" options={branchOptions} selected={branchFilter} onToggle={(v) => toggleMulti("branch", v, branchFilter)} />
        </div>
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Başlangıç tarihi
            </p>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setDateParam("from", e.target.value)}
              aria-label="Başlangıç tarihi"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)]"
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Bitiş tarihi
            </p>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setDateParam("to", e.target.value)}
              aria-label="Bitiş tarihi"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)]"
            />
          </div>
        </div>
        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          Toplam {rows.length} evrak{anyFilterActive ? ` · Filtre sonucu ${filtered.length}` : ""}
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Referans No</th>
              <th className="px-4 py-3">Evrak Türü</th>
              <th className="px-4 py-3">İlgili Kişi</th>
              <th className="px-4 py-3">Şube</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Oluşturulma</th>
              <th className="px-4 py-3">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Bu filtreye uyan evrak bulunamadı.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/panel/evraklar/${d.id}`} className="font-mono text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                      {d.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{d.kindLabel}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{d.personName}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{d.branchName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge status={d.status}>{d.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/panel/evraklar/${d.id}`} className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                        Görüntüle
                      </Link>
                      {d.status !== "cancelled" ? (
                        <button
                          type="button"
                          disabled={archiving === d.id}
                          onClick={() => void onArchive(d.id)}
                          className="text-xs font-medium text-[var(--color-danger)] hover:opacity-80 disabled:opacity-50"
                        >
                          {archiving === d.id ? "…" : "Arşivle"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function FilterChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(opt)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-soft-text)]"
                  : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
