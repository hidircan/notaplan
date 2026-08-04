import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  parseISO,
  isSameDay,
  addDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";
import { tr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, pattern = "d MMM yyyy") {
  return format(parseISO(iso), pattern, { locale: tr });
}

export function formatDateTime(iso: string) {
  return format(parseISO(iso), "d MMM yyyy · HH:mm", { locale: tr });
}

export function formatTime(iso: string) {
  return format(parseISO(iso), "HH:mm", { locale: tr });
}

export function formatMoney(amount: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function dayName(dayOfWeek: number) {
  const names = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  return names[dayOfWeek] ?? "";
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    present: "Geldi",
    absent: "Gelmedi",
    late: "Geç kaldı",
    cancelled_by_school: "Okul iptal",
    pending: "Bekliyor",
    suggested: "Slot önerildi",
    awaiting_info: "Bilgi bekleniyor",
    confirmed: "Onaylandı",
    completed: "Tamamlandı",
    expired: "Süresi doldu",
    cancelled: "İptal",
    paid: "Ödendi",
    overdue: "Gecikmiş",
    partial: "Kısmi",
    scheduled: "Planlandı",
    no_show: "Gelmedi",
    regular: "Normal",
    makeup: "Telafi",
    trial: "Deneme",
    group: "Grup",
    published: "Yayında",
    archived: "Arşivlendi",
  };
  return map[status] ?? status;
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    present: "bg-emerald-100 text-emerald-800",
    completed: "bg-emerald-100 text-emerald-800",
    paid: "bg-emerald-100 text-emerald-800",
    confirmed: "bg-emerald-100 text-emerald-800",
    absent: "bg-rose-100 text-rose-800",
    no_show: "bg-rose-100 text-rose-800",
    overdue: "bg-rose-100 text-rose-800",
    expired: "bg-rose-100 text-rose-800",
    cancelled: "bg-slate-100 text-slate-600",
    cancelled_by_school: "bg-slate-100 text-slate-600",
    pending: "bg-amber-100 text-amber-800",
    suggested: "bg-sky-100 text-sky-800",
    awaiting_info: "bg-orange-100 text-orange-800",
    partial: "bg-amber-100 text-amber-800",
    late: "bg-orange-100 text-orange-800",
    scheduled: "bg-indigo-100 text-indigo-800",
    makeup: "bg-violet-100 text-violet-800",
    published: "bg-emerald-100 text-emerald-800",
    archived: "bg-slate-200 text-slate-600",
  };
  return map[status] ?? "bg-slate-100 text-slate-700";
}

export { isSameDay, addDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, format };
