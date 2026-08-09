"use client";

/**
 * İş Takip görünüm tercihi — Kanban varsayılan, Liste alternatif. Tercih
 * yalnızca bu tarayıcıda `localStorage`'da saklanır (theme/sidebar sırası
 * ile AYNI ilke: görsel bir tercih, RBAC/route yapısını etkilemez).
 * Kullanıcı "Liste görünümü"nü seçerse bir daha /panel/is-takip'e
 * geldiğinde otomatik Kanban'a yönlendirilmez — tercihi geri alınabilir
 * (Kanban'a dönünce tercih yeniden "kanban" olur).
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const VIEW_PREFERENCE_KEY = "notaplan_is_takip_view";

/** Liste sayfasına (server component) gömülür — mount'ta tercihi kontrol eder. */
export function IsTakipDefaultViewRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_PREFERENCE_KEY);
      if (stored !== "liste") {
        router.replace("/panel/is-takip/kanban");
      }
    } catch {
      // localStorage erişilemiyorsa (gizli mod vb.) varsayılan liste kalır.
    }
  }, [router]);

  return null;
}

/** Görünüm değiştirme bağlantısı — tıklanınca tercihi kaydeder, sonra normal <Link> gibi gider. */
export function IsTakipViewLink({
  href,
  view,
  children,
  className,
}: {
  href: string;
  view: "liste" | "kanban";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          window.localStorage.setItem(VIEW_PREFERENCE_KEY, view);
        } catch {
          // sessizce yoksay — tercih kalıcı olmaz ama gezinme çalışmaya devam eder.
        }
      }}
    >
      {children}
    </Link>
  );
}
