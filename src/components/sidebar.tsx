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
  Sparkles,
  Activity,
  ScrollText,
  Workflow,
  Brain,
  Settings,
  Upload,
  FileText,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

const nav = [
  { href: "/panel", label: "Özet", icon: LayoutDashboard },
  { href: "/panel/chat", label: "AI Asistan", icon: Sparkles },
  { href: "/panel/workflows", label: "Workflows", icon: Workflow },
  { href: "/panel/ai", label: "AI Dashboard", icon: Activity },
  { href: "/panel/ai/logs", label: "AI Logları", icon: ScrollText },
  { href: "/panel/ai/memory", label: "AI Memory", icon: Brain },
  { href: "/panel/program", label: "Ders Programı", icon: CalendarDays },
  { href: "/panel/telafi", label: "Telafi Merkezi", icon: RefreshCcw },
  { href: "/panel/yoklama", label: "Yoklama", icon: ClipboardCheck },
  { href: "/panel/ders-duzeltme", label: "Ders düzeltme", icon: ClipboardCheck },
  { href: "/panel/deneme", label: "Deneme dersleri", icon: Users },
  { href: "/panel/evraklar", label: "Evraklar", icon: FileText },
  { href: "/panel/ogrenciler", label: "Öğrenciler", icon: GraduationCap },
  { href: "/panel/ogretmenler", label: "Öğretmenler", icon: Users },
  { href: "/panel/odemeler", label: "Ödemeler", icon: CreditCard },
  { href: "/panel/bildirimler", label: "WhatsApp", icon: MessageCircle },
  { href: "/panel/duyurular", label: "Duyurular", icon: Megaphone },
  { href: "/panel/subeler", label: "Şubeler", icon: Home },
  { href: "/panel/ucret-kurallari", label: "Ücret kuralları", icon: CreditCard },
];

const portals = [
  { href: "/veli", label: "Veli portalı", icon: UserRound },
  { href: "/ogretmen", label: "Öğretmen portalı", icon: Users },
  { href: "/", label: "Landing", icon: Home },
];

const setup = [
  { href: "/panel/kurulum", label: "Kurulum Merkezi", icon: Settings },
  { href: "/panel/veri-aktar", label: "Veri Aktar", icon: Upload },
];

export function Sidebar({
  schoolName,
  userLabel,
  roleLabel,
}: {
  schoolName: string;
  userLabel?: string;
  roleLabel?: string;
}) {
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
          <p className="text-[10px] text-slate-500">
            {roleLabel || "Oturum"} · {userLabel || "—"}
          </p>
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

      <div className="border-t border-white/10 px-3 py-4">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Kurulum
        </p>
        {setup.map((item) => {
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
            </Link>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-4">
        <LogoutButton className="w-full justify-start text-slate-300 hover:text-white" />
      </div>
    </aside>
  );
}
