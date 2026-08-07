"use client";

/**
 * ÖNCELİK 4 (devam) — /panel/program üstü akademik yıl + Güz/Yaz seçici.
 * Mevcut haftalık `?week=` navigasyonundan AYRI, program ekranına özel
 * `progTerm`/`progYear` query param'larını kullanır (attendance calendar'ın
 * `attTerm`/`attYear`'ı ile çakışmaz — iki ekran bağımsız state tutar, aynı
 * isimlendirme kuralını paylaşır). Dönem/yıl değişince hem bu iki param hem
 * de `week` (seçilen dönemin ilk haftasına) güncellenir — sunucu bileşeni
 * (page.tsx) `week`'ten haftayı, `progTerm`/`progYear`'dan filtre + yeni
 * ders varsayılanını türetir.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type ProgramTerm = "guz" | "yaz";

function firstWeekStart(term: ProgramTerm, academicYearStart: number): string {
  // Güz: academicYearStart yılının 1 Eylül'ü. Yaz: academicYearStart yılının 1 Temmuz'u.
  const month = term === "guz" ? "09" : "07";
  return `${academicYearStart}-${month}-01`;
}

export function ProgramTermYearNav({
  term,
  academicYearStart,
}: {
  term: ProgramTerm;
  academicYearStart: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(nextTerm: ProgramTerm, nextYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("progTerm", nextTerm);
    params.set("progYear", String(nextYear));
    params.set("week", firstWeekStart(nextTerm, nextYear));
    router.push(`/panel/program?${params.toString()}`);
  }

  const label = term === "guz" ? `${academicYearStart}–${academicYearStart + 1} Güz` : `${academicYearStart} Yaz`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-1 rounded-md border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="Akademik dönem seçimi">
        <button
          type="button"
          aria-pressed={term === "guz"}
          onClick={() => navigate("guz", term === "guz" ? academicYearStart : academicYearStart)}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-semibold transition",
            term === "guz" ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          )}
        >
          Güz
        </button>
        <button
          type="button"
          aria-pressed={term === "yaz"}
          onClick={() => navigate("yaz", term === "yaz" ? academicYearStart : academicYearStart)}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-semibold transition",
            term === "yaz" ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          )}
        >
          Yaz
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Önceki akademik yıl"
          onClick={() => navigate(term, academicYearStart - 1)}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ←
        </button>
        <span className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{label}</span>
        <button
          type="button"
          aria-label="Sonraki akademik yıl"
          onClick={() => navigate(term, academicYearStart + 1)}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          →
        </button>
      </div>
    </div>
  );
}
