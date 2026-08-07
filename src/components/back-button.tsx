"use client";

/**
 * ÖNCELİK 4 (devam) — Paneldeki detay/oluşturma/düzenleme ekranları için
 * tek, tekrar kullanılabilir "Geri" bileşeni (item 4 — "her ekranda farklı,
 * kopyalanmış kod yazma"). Öncelik sırası: 1) tarayıcı geçmişi
 * (`router.back()`) — yalnızca bu SEKME içinde bu uygulamadan gelen bir
 * önceki girdi varsa güvenli sayılır (`document.referrer` aynı origin +
 * `window.history.length > 1` kontrolü); 2) yoksa `fallbackHref`'e (liste
 * ekranı) düz `Link` ile gider — dış kaynaktan/doğrudan URL ile gelindiğinde
 * bu ikincisi devreye girer.
 */

import { useCallback, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** SSR'da her zaman false (document/window yok); istemcide ilk render'da lazy initializer ile bir kez hesaplanır — effect/setState döngüsü yok. */
function computeCanGoBack(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sameOriginReferrer = document.referrer && new URL(document.referrer).origin === window.location.origin;
    return Boolean(sameOriginReferrer) && window.history.length > 1;
  } catch {
    return false;
  }
}

export function BackButton({
  fallbackHref,
  label = "Geri",
  /** Formda kaydedilmemiş değişiklik varsa true geçirin — ayrılmadan önce onay ister. */
  hasUnsavedChanges,
  className,
}: {
  fallbackHref: string;
  label?: string;
  hasUnsavedChanges?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [canGoBack] = useState(computeCanGoBack);

  const confirmLeaveIfDirty = useCallback((): boolean => {
    if (!hasUnsavedChanges) return true;
    return window.confirm("Kaydedilmemiş değişiklikleriniz var. Yine de ayrılmak istiyor musunuz?");
  }, [hasUnsavedChanges]);

  function onClick(e: MouseEvent) {
    if (!confirmLeaveIfDirty()) {
      e.preventDefault();
      return;
    }
    if (canGoBack) {
      e.preventDefault();
      router.back();
    }
    // canGoBack=false ise <Link> zaten fallbackHref'e gidiyor, ek işlem gerekmez.
  }

  return (
    <Link
      href={fallbackHref}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </Link>
  );
}
