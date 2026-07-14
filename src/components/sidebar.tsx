"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Music2,
  RefreshCcw,
  ClipboardCheck,
  Users,
  MessageCircle,
  Home,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/panel", label: "Özet", icon: LayoutDashboard },
  { href: "/panel/program", label: "Ders Programı", icon: CalendarDays },
  { href: "/panel/telafi", label: "Telafi Merkezi", icon: RefreshCcw },
  { href: "/panel/yoklama", label: "Yoklama", icon: ClipboardCheck },
  { href: "/panel/ogrenciler", label: "Öğrenciler", icon: GraduationCap },
  { href: "/panel/ogretmenler", label: "Öğretmenler", icon: Users },
  { href: "/panel/odemeler", label: "Ödemeler", icon: CreditCard },
  { href: "/panel/bildirimler", label: "WhatsApp", icon: MessageCircle },
];

const portals = [
  { href: "/veli", label: "Veli portalı", icon: UserRound },
  { href: "/ogretmen", label: "Öğretmen portalı", icon: Users },
  { href: "/", label: "Landing", icon: Home },
];

export function Sidebar({ schoolName }: { schoolName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-[#0f0b1a] text-slate-200">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
            <Music2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">NotaPlan</p>
            <p className="text-[11px] text-slate-400">Müzik okulu yönetimi</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-white/5 px-3 py-2">
          <p className="truncate text-xs font-medium text-violet-200">{schoolName}</p>
          <p className="text-[10px] text-slate-500">Erzene · Evka 3 · İzmir</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-violet-500/20 text-white shadow-inner"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-violet-300" : "")} />
              {item.label}
              {item.href === "/panel/telafi" ? (
                <span className="ml-auto rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  ★
                </span>
              ) : null}
            </Link>
          );
        })}

        <p className="mb-1 mt-5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Portaller
        </p>
        {portals.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="text-[11px] leading-relaxed text-slate-500">
          İlk müşteri: Nilüfer Acar Müzik Akademisi · 2 şube
        </p>
      </div>
    </aside>
  );
}
