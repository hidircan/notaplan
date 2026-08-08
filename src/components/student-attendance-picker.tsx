"use client";

/**
 * Yoklama Takvimi'nin öğrenci arama/seçici bileşeni. Yalnız server tarafından
 * tenant-scoped olarak geçirilen `students` listesi içinde filtreler — burada
 * hiçbir ek fetch/veri erişimi yoktur, dolayısıyla cross-tenant sızıntı riski
 * yok. Seçim `?studentId=` query param'ına yazılır; asıl doğrulama (bu ID'nin
 * gerçekten scoped listede olup olmadığı) sayfa (server component) tarafında
 * `resolveAttendanceCalendarStudentId` ile tekrar yapılır.
 */

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui";

export type AttendanceStudentOption = { id: string; name: string; branchName?: string };

export function StudentAttendancePicker({
  students,
  selectedStudentId,
}: {
  students: AttendanceStudentOption[];
  selectedStudentId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return students.slice(0, 20);
    return students.filter((s) => s.name.toLocaleLowerCase("tr").includes(q)).slice(0, 20);
  }, [query, students]);

  function select(studentId: string) {
    const params = new URLSearchParams();
    params.set("studentId", studentId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="Öğrenci ara…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Öğrenci ara"
      />
      <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--color-border)]">
        {filtered.length === 0 ? (
          <p className="p-3 text-xs text-[var(--color-text-muted)]">Öğrenci bulunamadı.</p>
        ) : (
          <ul>
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => select(s.id)}
                  aria-pressed={s.id === selectedStudentId}
                  className={`w-full border-b border-[var(--color-border)] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[var(--color-bg)] ${
                    s.id === selectedStudentId ? "bg-[var(--color-bg)] font-semibold" : ""
                  }`}
                >
                  {s.name}
                  {s.branchName ? <span className="ml-2 text-xs text-[var(--color-text-muted)]">{s.branchName}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
