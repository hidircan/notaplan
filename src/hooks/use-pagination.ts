"use client";

/**
 * Genel amaçlı, saf (side-effect'siz) client-side sayfalama hook'u. Tek bir
 * ekranda birbirinden BAĞIMSIZ birden fazla liste sayfalanacaksa (ör.
 * öğrenci detayında Yaklaşan/Geçmiş/Yoklama), her liste için ayrı bir
 * `usePagination` çağrısı yapılır — state tamamen izole kalır, hiçbir
 * navigasyon/scroll tetiklenmez.
 */

import { useMemo, useState } from "react";

export interface UsePaginationResult<T> {
  page: number;
  totalPages: number;
  pageItems: T[];
  totalItems: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  goToPage: (page: number) => void;
  goPrev: () => void;
  goNext: () => void;
}

/** Saf yardımcılar — React olmadan (unit test) doğrudan test edilebilir. */
export function computeTotalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), totalPages);
}

export function sliceForPage<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function usePagination<T>(items: T[], pageSize: number): UsePaginationResult<T> {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = computeTotalPages(totalItems, pageSize);
  // Liste küçülürse (ör. filtre değişimi) geçerli sayfa aralık dışında
  // kalmasın — clamp edilir, ama state'i render sırasında mutasyona
  // uğratmadan güvenli biçimde.
  const safePage = clampPage(page, totalPages);

  const pageItems = useMemo(() => sliceForPage(items, safePage, pageSize), [items, safePage, pageSize]);

  function goToPage(next: number) {
    setPage(clampPage(next, totalPages));
  }

  return {
    page: safePage,
    totalPages,
    pageItems,
    totalItems,
    canGoPrev: safePage > 1,
    canGoNext: safePage < totalPages,
    goToPage,
    goPrev: () => goToPage(safePage - 1),
    goNext: () => goToPage(safePage + 1),
  };
}
