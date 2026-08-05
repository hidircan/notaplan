"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music2, Home, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import {
  PANEL_MAIN_NAV,
  PANEL_OPS_NAV,
  PANEL_AI_NAV,
  PANEL_SYSTEM_NAV,
  isNavActive,
} from "@/lib/nav/panel-nav";

function NavSection({
  title,
  items,
  pathname,
}: {
  title?: string;
  items: typeof PANEL_MAIN_NAV;
  pathname: string;
}) {
  return (
    <div className="space-y-0.5">
      {title ? (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          {title}
        </p>
      ) : null}
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-[#A56A00]/15 font-semibold text-[#5c3d00]"
                : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#A56A00]" : "text-stone-500")} />
            {item.label}
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
  kurumlar: _kurumlar,
  kurumSelection: _kurumSelection,
  canSeeAllKurumlar: _canSeeAllKurumlar,
}: {
  schoolName?: string;
  userLabel?: string;
  roleLabel?: string;
  kurumlar?: unknown;
  kurumSelection?: string;
  canSeeAllKurumlar?: boolean;
}) {
  const schoolNameSafe = schoolName ?? "NotaPlan";
  void _kurumlar;
  void _kurumSelection;
  void _canSeeAllKurumlar;
  const pathname = usePathname();

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-stone-200 bg-[#f7f4ef] text-stone-800"
      aria-label="Ana menü"
    >
      <div className="border-b border-stone-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#A56A00] text-white shadow-sm">
            <Music2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-stone-900">NotaPlan</p>
            <p className="text-[11px] text-stone-500">Kurum yönetimi</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-stone-200 bg-white px-3 py-2">
          <p className="truncate text-xs font-medium text-[#5c3d00]">{schoolNameSafe}</p>
          <p className="text-[10px] text-stone-500">
            {roleLabel || "Oturum"} · {userLabel || "—"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <NavSection items={PANEL_MAIN_NAV} pathname={pathname} />
        <NavSection title="Operasyonlar" items={PANEL_OPS_NAV} pathname={pathname} />
        <NavSection title="Yardımcı" items={PANEL_AI_NAV} pathname={pathname} />
      </nav>

      <div className="space-y-3 border-t border-stone-200 px-3 py-4">
        <NavSection title="Sistem" items={PANEL_SYSTEM_NAV} pathname={pathname} />
        <div className="space-y-0.5 px-0">
          <Link
            href="/ogretmen"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            <Users className="h-4 w-4" /> Öğretmen portalı
          </Link>
          <Link
            href="/veli"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            <UserRound className="h-4 w-4" /> Veli portalı
          </Link>
          <Link
            href="/ogrenci"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            <Home className="h-4 w-4" /> Öğrenci portalı
          </Link>
        </div>
        <div className="px-3 pt-1">
          <LogoutButton className="!text-xs" />
        </div>
      </div>
    </aside>
  );
}
