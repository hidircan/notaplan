import { Building2 } from "lucide-react";
import type { InstitutionScope } from "@/lib/institution/context";

/**
 * "Tüm kurumlar" görünümü seçiliyken sayfanın üstünde açık bir uyarı —
 * aksi halde birleşik toplamlar tek bir kurumun verisiymiş gibi okunabilir.
 * Tekil kurum seçiliyken hiçbir şey render etmez.
 */
export function KurumScopeNote({ scope }: { scope: InstitutionScope }) {
  if (scope.mode !== "all") return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      <Building2 className="h-3.5 w-3.5" />
      Tüm kurumlar görünümü — {scope.tenantIds.length} kurumun birleşik verisi gösteriliyor.
    </div>
  );
}
