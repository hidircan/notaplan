"use client";

import { useRouter } from "next/navigation";

/** Native date input that navigates the program page to the picked date's week (URL-driven, no local state). */
export function WeekDatePicker({ value }: { value: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      defaultValue={value}
      onChange={(event) => {
        if (event.target.value) {
          router.push(`/panel/program?week=${event.target.value}`);
        }
      }}
      aria-label="Tarih seç"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-muted)] outline-none ring-amber-200 focus:ring-2"
    />
  );
}
