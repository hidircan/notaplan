"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Music2, Home, UserRound, Users, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import {
  PANEL_MAIN_NAV,
  PANEL_OPS_NAV,
  PANEL_AI_NAV,
  PANEL_SYSTEM_NAV,
  isNavActive,
  type PanelNavItem,
} from "@/lib/nav/panel-nav";

/** Görsel bir tercih — kimlik doğrulama/kurum kapsamını etkilemez (theme.ts ile aynı ilke). */
const SIDEBAR_COLLAPSED_KEY = "notaplan_sidebar_collapsed";

type SessionRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "AI_AGENT" | "TEACHER" | "PARENT" | "STUDENT";

/** Bir menü öğesi bu rolde görünür mü — `roles` verilmemişse tüm panel personeli görür. */
function isVisibleForRole(item: PanelNavItem, role?: SessionRole): boolean {
  if (!item.roles) return true;
  if (!role) return true;
  return (item.roles as readonly string[]).includes(role);
}

function NavSection({
  title,
  items,
  pathname,
  role,
  collapsed,
}: {
  title?: string;
  items: PanelNavItem[];
  pathname: string;
  role?: SessionRole;
  collapsed: boolean;
}) {
  const visible = items.filter((item) => isVisibleForRole(item, role));
  if (visible.length === 0) return null;
  return (
    <div className="space-y-0.5">
      {title && !collapsed ? (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          {title}
        </p>
      ) : null}
      {visible.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              collapsed && "justify-center px-2",
              active
                ? "bg-[#A56A00]/15 font-semibold text-[#5c3d00]"
                : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#A56A00]" : "text-stone-500")} />
            {!collapsed ? item.label : null}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({
  schoolName,
  userLabel,
  roleLabel,
  role,
  kurumlar: _kurumlar,
  kurumSelection: _kurumSelection,
  canSeeAllKurumlar: _canSeeAllKurumlar,
}: {
  schoolName?: string;
  userLabel?: string;
  roleLabel?: string;
  /** RBAC filtresi için — `roleLabel` yalnız görsel metindir, filtre bu alanı kullanır. */
  role?: SessionRole;
  kurumlar?: unknown;
  kurumSelection?: string;
  canSeeAllKurumlar?: boolean;
}) {
  const schoolNameSafe = schoolName ?? "NotaPlan";
  void _kurumlar;
  void _kurumSelection;
  void _canSeeAllKurumlar;
  const pathname = usePathname();

  // Dar/geniş mod tercihi — yalnız görsel, kalıcı (localStorage). Mobilde
  // toggle hiç render edilmez (bkz. aşağıdaki `hidden md:inline-flex`) —
  // mobil deneyim bu değişiklikten etkilenmez.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // SSR ile ilk client render'ı HER ZAMAN "açık" (collapsed=false) üretir —
    // hydration uyuşmazlığı olmasın diye. Kayıtlı tercih yalnız mount
    // SONRASI, bilinçli olarak burada okunup uygulanır.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage senkron, yalnız mount'ta bir kez
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // localStorage erişilemez (gizli mod vb.) — varsayılan açık modda kal.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // sessizce yoksay — tercih kalıcı olmaz ama uygulama çalışmaya devam eder.
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-stone-200 bg-[#f7f4ef] text-stone-800 transition-[width]",
        collapsed ? "w-[72px]" : "w-64"
      )}
      aria-label="Ana menü"
    >
      <div className="border-b border-stone-200 px-3 py-5">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#A56A00] text-white shadow-sm">
            <Music2 className="h-5 w-5" aria-hidden />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-wide text-stone-900">NotaPlan</p>
              <p className="text-[11px] text-stone-500">Kurum yönetimi</p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-white px-3 py-2">
            <p className="truncate text-xs font-medium text-[#5c3d00]">{schoolNameSafe}</p>
            <p className="text-[10px] text-stone-500">
              {roleLabel || "Oturum"} · {userLabel || "—"}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          title={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          className="mt-3 hidden w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white py-1.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 md:inline-flex"
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          {!collapsed ? "Daralt" : null}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <NavSection items={PANEL_MAIN_NAV} pathname={pathname} role={role} collapsed={collapsed} />
        <NavSection title="Operasyonlar" items={PANEL_OPS_NAV} pathname={pathname} role={role} collapsed={collapsed} />
        <NavSection title="Yardımcı" items={PANEL_AI_NAV} pathname={pathname} role={role} collapsed={collapsed} />
      </nav>

      <div className="space-y-3 border-t border-stone-200 px-3 py-4">
        <NavSection title="Sistem" items={PANEL_SYSTEM_NAV} pathname={pathname} role={role} collapsed={collapsed} />
        <div className="space-y-0.5 px-0">
          <Link
            href="/ogretmen"
            title={collapsed ? "Öğretmen portalı" : undefined}
            aria-label="Öğretmen portalı"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100",
              collapsed && "justify-center px-2"
            )}
          >
            <Users className="h-4 w-4 shrink-0" /> {!collapsed ? "Öğretmen portalı" : null}
          </Link>
          <Link
            href="/veli"
            title={collapsed ? "Veli portalı" : undefined}
            aria-label="Veli portalı"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100",
              collapsed && "justify-center px-2"
            )}
          >
            <UserRound className="h-4 w-4 shrink-0" /> {!collapsed ? "Veli portalı" : null}
          </Link>
          <Link
            href="/ogrenci"
            title={collapsed ? "Öğrenci portalı" : undefined}
            aria-label="Öğrenci portalı"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100",
              collapsed && "justify-center px-2"
            )}
          >
            <Home className="h-4 w-4 shrink-0" /> {!collapsed ? "Öğrenci portalı" : null}
          </Link>
        </div>
        <div className={cn("pt-1", collapsed ? "px-0 text-center" : "px-3")}>
          <LogoutButton className="!text-xs" />
        </div>
      </div>
    </aside>
  );
}
