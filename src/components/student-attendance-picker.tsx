"use client";

/**
 * Yoklama Takvimi'nin öğrenci filtresi. Paket 6 — kompakt açılabilir liste
 * (native `<select>`), takvimin ÜSTÜNDE render edilir (yanında değil).
 * Yalnız server tarafından tenant-scoped olarak geçirilen `students` listesi
 * içinde filtreler — burada hiçbir ek fetch/veri erişimi yoktur, dolayısıyla
 * cross-tenant sızıntı riski yok. Seçim `?studentId=` query param'ına yazılır;
 * asıl doğrulama (bu ID'nin gerçekten scoped listede olup olmadığı) sayfa
 * (server component) tarafında `resolveAttendanceCalendarStudentId` ile
 * tekrar yapılır.
 */

import { useRouter, usePathname } from "next/navigation";

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

  function select(studentId: string) {
    if (!studentId) return;
    const params = new URLSearchParams();
    params.set("studentId", studentId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={selectedStudentId ?? ""}
      onChange={(e) => select(e.target.value)}
      aria-label="Öğrenci seç"
      className="w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
    >
      <option value="" disabled>
        Öğrenci seçin…
      </option>
      {students.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.branchName ? ` — ${s.branchName}` : ""}
        </option>
      ))}
    </select>
  );
}
