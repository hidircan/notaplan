/**
 * Panel sol menü — tek kaynak. Tüm panel sayfaları Sidebar üzerinden bunu kullanır.
 * Sprint: Fonksiyon Onarımı + Kurumsal UI — ana iş akışı sırası sabit.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  Wallet,
  RefreshCcw,
  GraduationCap,
  Users,
  MessageCircle,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Sparkles,
  Settings,
  Upload,
  Activity,
  ScrollText,
  Brain,
  Workflow,
  Building2,
  Wrench,
  Palette,
} from "lucide-react";

export type PanelNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see this item; undefined = all panel staff */
  roles?: Array<"SUPER_ADMIN" | "SCHOOL_ADMIN" | "AI_AGENT">;
};

/** Ana menü — sıra kesindir (prompt §B). */
export const PANEL_MAIN_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Özet", icon: LayoutDashboard },
  { href: "/panel/program", label: "Ders Programı", icon: CalendarDays },
  { href: "/panel/ai/tahsilat-agent", label: "Tahsilatlar", icon: Wallet },
  { href: "/panel/odemeler", label: "Ödemeler", icon: CreditCard },
  { href: "/panel/telafi", label: "Telafi Merkezi", icon: RefreshCcw },
  { href: "/panel/ogrenciler", label: "Öğrenciler", icon: GraduationCap },
  { href: "/panel/ogretmenler", label: "Öğretmenler", icon: Users },
  { href: "/panel/ogretmenler?view=hakedis", label: "Öğretmen Hakedişleri", icon: Wallet },
  { href: "/panel/bildirimler", label: "WhatsApp", icon: MessageCircle },
  { href: "/panel/yoklama", label: "Yoklama", icon: ClipboardCheck },
];

export const PANEL_OPS_NAV: PanelNavItem[] = [
  { href: "/panel/evraklar", label: "Evraklar", icon: FileText },
  { href: "/panel/deneme", label: "Deneme Dersleri", icon: FlaskConical },
  { href: "/panel/ders-duzeltme", label: "Ders düzeltme", icon: Wrench },
  { href: "/panel/duyurular", label: "Duyurular", icon: MessageCircle },
  { href: "/panel/subeler", label: "Şubeler", icon: Building2 },
];

export const PANEL_AI_NAV: PanelNavItem[] = [
  { href: "/panel/chat", label: "Asistan", icon: Sparkles },
  { href: "/panel/ai", label: "AI Özet", icon: Activity },
  { href: "/panel/ai/logs", label: "AI Log", icon: ScrollText },
  { href: "/panel/ai/memory", label: "AI Bellek", icon: Brain },
  { href: "/panel/workflows", label: "İş Akışları", icon: Workflow },
];

export const PANEL_SYSTEM_NAV: PanelNavItem[] = [
  { href: "/panel/kurulum", label: "Kurulum Merkezi", icon: Settings },
  { href: "/panel/veri-aktar", label: "Veri Aktarım Merkezi", icon: Upload },
  { href: "/panel/gorunum-ayarlari", label: "Görünüm Ayarları", icon: Palette },
];

export function isNavActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0] ?? href;
  if (base === "/panel") return pathname === "/panel";
  return pathname === base || pathname.startsWith(`${base}/`);
}
