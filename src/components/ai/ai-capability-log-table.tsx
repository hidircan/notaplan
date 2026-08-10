"use client";

/**
 * Filterable view of `AiAuditLog` rows for the unified "AI Logları" screen —
 * the PRIMARY table on that page (capability, rol, provider, onay durumu,
 * başarı/hata). Client-side filtering only (no extra fetch — the page
 * already loads all rows server-side); simple enough not to need a route.
 */
import { useMemo, useState } from "react";
import { Badge, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export type CapabilityLogRow = {
  id: string;
  createdAtIso: string;
  capabilityId: string;
  callerRole: string;
  chosenProvider: string;
  usedFallback: boolean;
  approvalStatus: string;
  success: boolean;
  errorMessage: string | null;
};

const APPROVAL_LABEL: Record<string, string> = {
  not_required: "Onay gerekmiyor",
  pending_approval: "Onay bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export function AiCapabilityLogTable({ rows }: { rows: CapabilityLogRow[] }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all");
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all");

  const capabilities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.capabilityId))).sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter === "success" && !r.success) return false;
        if (statusFilter === "error" && r.success) return false;
        if (capabilityFilter !== "all" && r.capabilityId !== capabilityFilter) return false;
        return true;
      }),
    [rows, statusFilter, capabilityFilter]
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          className="w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "success" | "error")}
          aria-label="Duruma göre filtrele"
        >
          <option value="all">Tümü ({rows.length})</option>
          <option value="success">Başarılı ({rows.filter((r) => r.success).length})</option>
          <option value="error">Hatalı ({rows.filter((r) => !r.success).length})</option>
        </Select>
        <Select
          className="w-auto"
          value={capabilityFilter}
          onChange={(e) => setCapabilityFilter(e.target.value)}
          aria-label="Capability'ye göre filtrele"
        >
          <option value="all">Tüm capability&apos;ler</option>
          {capabilities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <span className="ml-auto text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
          {filtered.length} sonuç
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)] dark:border-slate-800 dark:bg-slate-900/60 dark:text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Zaman</th>
              <th className="px-3 py-2">Capability</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Onay durumu</th>
              <th className="px-3 py-2">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                  {rows.length === 0
                    ? "Henüz capability çağrısı yok — Yoklama/Telafi/Tahsilat/Öğretmenler/Öğrenciler ekranlarındaki AI butonlarını deneyin."
                    : "Bu filtreye uyan kayıt yok."}
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                    {formatDateTime(log.createdAtIso)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{log.capabilityId}</td>
                  <td className="px-3 py-2 text-xs">{log.callerRole}</td>
                  <td className="px-3 py-2 text-xs">
                    {log.chosenProvider}
                    {log.usedFallback ? <span className="ml-1 text-amber-600">(fallback)</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      status={
                        log.approvalStatus === "approved"
                          ? "completed"
                          : log.approvalStatus === "rejected"
                            ? "expired"
                            : log.approvalStatus === "pending_approval"
                              ? "pending"
                              : undefined
                      }
                    >
                      {APPROVAL_LABEL[log.approvalStatus] ?? log.approvalStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge status={log.success ? "completed" : "expired"}>
                      {log.success ? "ok" : "error"}
                    </Badge>
                    {!log.success && log.errorMessage ? (
                      <span className="mt-0.5 block max-w-[180px] truncate text-[10px] text-rose-600">
                        {log.errorMessage}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
