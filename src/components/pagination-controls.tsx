"use client";

/**
 * Uzun listeler (Öğrenciler, Ödemeler, Ödeme geçmişi vb.) için ortak
 * sayfalama — sayfa başına kayıt sayısı seçimi (10/30/50) + sayfalar
 * arasında geçiş. Tamamen istemci tarafında (rows zaten filtrelenmiş
 * diziyi verir) — mevcut arama/filtre/sıralama mantığına dokunmaz, yalnızca
 * son adımda görüntülenen alt kümeyi keser.
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE_OPTIONS = [10, 30, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

/**
 * Saf sayfalama matematiği — `usePagination`'dan çıkarıldı ki React
 * render/hook ortamı olmadan (bu repoda component render testi altyapısı
 * yok — jsdom/@testing-library kurulu değil, vitest `environment: "node"`)
 * `src/lib/__tests__` içinde saf bir `.ts` testiyle doğrulanabilsin.
 */
export function computePagination<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page: clampedPage,
    totalPages,
    totalCount: items.length,
  };
}

/**
 * `defaultPageSize`/`pageSize` kasıtlı olarak `number` (yalnız `PageSize`
 * değil) — bu, sabit sayfa boyutlu (ör. öğrenci detayında 3'lük, seçici
 * OLMADAN) kullanım alanlarının da aynı sayfalama matematiğini
 * paylaşabilmesi için; `PaginationControls`'un 10/30/50 seçicisi ayrı bir
 * UI parçası, `usePagination`'ın kabul ettiği değerleri kısıtlamaz.
 */
export function usePagination<T>(items: T[], defaultPageSize: number = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);

  // Filtre/arama değişip liste küçüldüğünde, artık var olmayan bir sayfada
  // görüntü kalmasın diye render sırasında kırpılır (bkz. `page` state'i
  // kendisi hiç değiştirilmez — bir sonraki manuel sayfa değişiminde veya
  // listenin tekrar büyümesiyle doğal olarak düzelir; ekstra bir efekt/
  // setState döngüsü gerekmez).
  const { pageItems, page: clampedPage, totalPages, totalCount } = useMemo(
    () => computePagination(items, page, pageSize),
    [items, page, pageSize]
  );

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return { pageItems, page: clampedPage, setPage, pageSize, setPageSize: changePageSize, totalPages, totalCount };
}

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalCount === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        <span>Sayfa başına</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          aria-label="Sayfa başına kayıt sayısı"
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text)]"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span>kayıt · Toplam {totalCount}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Önceki sayfa"
          className="inline-flex items-center justify-center rounded-md border border-[var(--color-border-strong)] p-1.5 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-1 text-[var(--color-text-muted)]">
          Sayfa {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Sonraki sayfa"
          className="inline-flex items-center justify-center rounded-md border border-[var(--color-border-strong)] p-1.5 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
