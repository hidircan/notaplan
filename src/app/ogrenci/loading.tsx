import { Loader2 } from "lucide-react";

export default function OgrenciPortalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-slate-50">
      <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        <p className="text-sm">Programınız yükleniyor…</p>
      </div>
    </div>
  );
}
