"use client";

import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export type StudentRow = {
  id: string;
  name: string;
  parentName: string;
  parentPhone: string;
  branchName?: string;
  notes?: string;
  instruments: string[];
  teacherName?: string;
  packageName: string;
  weeklyLessonCount: number;
  monthlyFee: number;
  active: boolean;
  /** EPIC 4 — hepsi opsiyonel; boşsa rozet/etiket gösterilmez. */
  studentType?: string;
  enrollmentEndDate?: string;
  level?: string;
  targetExam?: string;
};

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Pasif" },
];

export function StudentsTable({ rows }: { rows: StudentRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !row.name.toLowerCase().includes(query)) return false;
      if (statusFilter === "active" && !row.active) return false;
      if (statusFilter === "inactive" && row.active) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Öğrenci adına göre ara..."
          aria-label="Öğrenci adına göre ara"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-violet-200 focus:ring-2 sm:w-auto"
        />

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                statusFilter === filter.value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs font-medium text-slate-500">
          {filtered.length} sonuç
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Öğrenci</th>
              <th className="px-4 py-3">Tür / Hedef</th>
              <th className="px-4 py-3">Enstrüman</th>
              <th className="px-4 py-3">Öğretmen</th>
              <th className="px-4 py-3">Paket</th>
              <th className="px-4 py-3">Ücret</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Bu filtreye uyan öğrenci bulunamadı.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const enrollmentEnded = s.enrollmentEndDate ? new Date(s.enrollmentEndDate) < new Date() : false;
                return (
                <tr key={s.id} className="border-b border-slate-50 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      Veli: {s.parentName} · {s.parentPhone} · {s.branchName}
                    </p>
                    {s.notes ? <p className="mt-1 text-xs text-violet-600">{s.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {s.studentType ? <Badge>{s.studentType}</Badge> : <span className="text-xs text-slate-400">Belirtilmemiş</span>}
                    {s.level ? <p className="mt-1 text-xs text-slate-500">Seviye: {s.level}</p> : null}
                    {s.targetExam ? <p className="text-xs text-slate-500">{s.targetExam}</p> : null}
                    {enrollmentEnded ? (
                      <p className="mt-1 text-xs font-medium text-rose-600">Kayıt sona erdi</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {s.instruments.map((i) => (
                      <Badge key={i}>{i}</Badge>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.teacherName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{s.packageName}</p>
                    <p className="text-xs text-slate-400">{s.weeklyLessonCount} ders/hafta</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatMoney(s.monthlyFee)}</td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
