"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";

export type StudentRow = {
  id: string;
  name: string;
  branchName?: string;
  instruments: string[];
  teacherName?: string;
  packageName: string;
  monthlyFee: number;
  active: boolean;
  studentType?: string;
  enrollmentStartDate?: string;
  enrollmentEndDate?: string;
  level?: string;
  targetExam?: string;
  educationMethod?: string;
  /** Öğrencinin en güncel/aciliyeti en yüksek ödeme durumu — tek etiket. */
  paymentStatus: "paid" | "overdue" | "partial" | "pending" | "none";
};

const STATUS_FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Pasif" },
] as const;

const PAYMENT_LABELS: Record<StudentRow["paymentStatus"], string> = {
  paid: "Güncel",
  overdue: "Gecikmiş",
  partial: "Kısmi",
  pending: "Bekliyor",
  none: "Kayıt yok",
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function ChipGroup({
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

export function StudentsTable({ rows }: { rows: StudentRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const statusFilter = (searchParams.get("status") ?? "all") as (typeof STATUS_FILTERS)[number]["value"];
  const typeFilter = searchParams.getAll("type");
  const branchFilter = searchParams.getAll("branch");
  const packageFilter = searchParams.getAll("package");
  const teacherFilter = searchParams.getAll("teacher");
  const methodFilter = searchParams.getAll("method");
  const levelFilter = searchParams.getAll("level");
  const paymentFilter = searchParams.getAll("payment");
  const enrolledFrom = searchParams.get("from") ?? "";
  const enrolledTo = searchParams.get("to") ?? "";

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setSingle(key: string, value: string) {
    updateParams((params) => {
      if (value && value !== "all" && value !== "") params.set(key, value);
      else params.delete(key);
    });
  }

  function toggleMulti(key: string, value: string, current: string[]) {
    updateParams((params) => {
      const next = toggleInList(current, value);
      params.delete(key);
      next.forEach((v) => params.append(key, v));
    });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const branchOptions = useMemo(() => uniqueSorted(rows.map((r) => r.branchName)), [rows]);
  const typeOptions = useMemo(() => uniqueSorted(rows.map((r) => r.studentType)), [rows]);
  const packageOptions = useMemo(() => uniqueSorted(rows.map((r) => r.packageName)), [rows]);
  const teacherOptions = useMemo(() => uniqueSorted(rows.map((r) => r.teacherName)), [rows]);
  const methodOptions = useMemo(() => uniqueSorted(rows.map((r) => r.educationMethod)), [rows]);
  const levelOptions = useMemo(() => uniqueSorted(rows.map((r) => r.level)), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !row.name.toLowerCase().includes(query)) return false;
      if (statusFilter === "active" && !row.active) return false;
      if (statusFilter === "inactive" && row.active) return false;
      if (typeFilter.length && !(row.studentType && typeFilter.includes(row.studentType))) return false;
      if (branchFilter.length && !(row.branchName && branchFilter.includes(row.branchName))) return false;
      if (packageFilter.length && !packageFilter.includes(row.packageName)) return false;
      if (teacherFilter.length && !(row.teacherName && teacherFilter.includes(row.teacherName))) return false;
      if (methodFilter.length && !(row.educationMethod && methodFilter.includes(row.educationMethod))) return false;
      if (levelFilter.length && !(row.level && levelFilter.includes(row.level))) return false;
      if (paymentFilter.length && !paymentFilter.includes(row.paymentStatus)) return false;
      if (enrolledFrom && (!row.enrollmentStartDate || row.enrollmentStartDate < enrolledFrom)) return false;
      if (enrolledTo && (!row.enrollmentStartDate || row.enrollmentStartDate > enrolledTo)) return false;
      return true;
    });
  }, [
    rows,
    search,
    statusFilter,
    typeFilter,
    branchFilter,
    packageFilter,
    teacherFilter,
    methodFilter,
    levelFilter,
    paymentFilter,
    enrolledFrom,
    enrolledTo,
  ]);

  const anyFilterActive =
    Boolean(search) ||
    statusFilter !== "all" ||
    typeFilter.length > 0 ||
    branchFilter.length > 0 ||
    packageFilter.length > 0 ||
    teacherFilter.length > 0 ||
    methodFilter.length > 0 ||
    levelFilter.length > 0 ||
    paymentFilter.length > 0 ||
    Boolean(enrolledFrom) ||
    Boolean(enrolledTo);

  return (
    <>
      <Card className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSingle("q", event.target.value)}
            placeholder="Ad soyada göre ara..."
            aria-label="Ad soyada göre ara"
            className="w-full max-w-xs rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]/30 sm:w-auto"
          />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSingle("status", filter.value)}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium ${
                  statusFilter === filter.value
                    ? "bg-[var(--color-text)] text-white"
                    : "border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-muted)]">Kayıt tarihi:</label>
            <input
              type="date"
              value={enrolledFrom}
              onChange={(e) => setSingle("from", e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)]"
              aria-label="Kayıt tarihi başlangıç"
            />
            <span className="text-xs text-[var(--color-text-muted)]">–</span>
            <input
              type="date"
              value={enrolledTo}
              onChange={(e) => setSingle("to", e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)]"
              aria-label="Kayıt tarihi bitiş"
            />
          </div>
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ChipGroup label="Öğrenci türü" options={typeOptions} selected={typeFilter} onToggle={(v) => toggleMulti("type", v, typeFilter)} />
          <ChipGroup label="Şube" options={branchOptions} selected={branchFilter} onToggle={(v) => toggleMulti("branch", v, branchFilter)} />
          <ChipGroup label="Öğretmen" options={teacherOptions} selected={teacherFilter} onToggle={(v) => toggleMulti("teacher", v, teacherFilter)} />
          <ChipGroup label="Eğitim metodu" options={methodOptions} selected={methodFilter} onToggle={(v) => toggleMulti("method", v, methodFilter)} />
          <ChipGroup label="Paket" options={packageOptions} selected={packageFilter} onToggle={(v) => toggleMulti("package", v, packageFilter)} />
          <ChipGroup label="MEB/LCM seviye" options={levelOptions} selected={levelFilter} onToggle={(v) => toggleMulti("level", v, levelFilter)} />
          <ChipGroup
            label="Ödeme durumu"
            options={["paid", "overdue", "partial", "pending", "none"]}
            selected={paymentFilter}
            onToggle={(v) => toggleMulti("payment", v, paymentFilter)}
          />
        </div>

        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          Toplam {rows.length} öğrenci
          {anyFilterActive ? ` · Filtre sonucu ${filtered.length}` : ""}
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Öğrenci</th>
              <th className="px-4 py-3">Şube</th>
              <th className="px-4 py-3">Tür / Seviye</th>
              <th className="px-4 py-3">Enstrüman</th>
              <th className="px-4 py-3">Öğretmen</th>
              <th className="px-4 py-3">Paket</th>
              <th className="px-4 py-3">Ödeme</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Bu filtreye uyan öğrenci bulunamadı.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-border)] align-top last:border-0">
                  <td className="p-0">
                    <Link
                      href={`/panel/ogrenciler/${s.id}`}
                      className="block px-4 py-3 hover:bg-[var(--color-surface-muted)] focus-visible:bg-[var(--color-surface-muted)] focus-visible:outline-none"
                    >
                      <p className="font-medium text-[var(--color-text)]">{s.name}</p>
                      {!s.active ? <span className="text-xs font-medium text-[var(--color-danger)]">Pasif</span> : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{s.branchName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.studentType ? <Badge>{s.studentType}</Badge> : <span className="text-xs text-[var(--color-text-muted)]">Belirtilmemiş</span>}
                    {s.level ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">Seviye: {s.level}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {s.instruments.map((i) => (
                      <Badge key={i}>{i}</Badge>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{s.teacherName}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{s.packageName.split("—")[0]?.trim() ?? s.packageName}</td>
                  <td className="px-4 py-3">
                    <Badge status={s.paymentStatus === "none" ? undefined : s.paymentStatus}>
                      {PAYMENT_LABELS[s.paymentStatus]}
                    </Badge>
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

function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) => a.localeCompare(b, "tr"));
}
