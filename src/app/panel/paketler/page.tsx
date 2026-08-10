import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { PageHeader } from "@/components/ui";
import { PackageManager } from "@/components/package-manager";

export const dynamic = "force-dynamic";

/**
 * ÖNCELİK 4 (devam) — Paket Yönetimi. Yalnızca SCHOOL_ADMIN/SUPER_ADMIN
 * erişebilir (mevcut ücret-kuralları sayfasıyla aynı desen). Tenant
 * izolasyonu `readScopedData(kurum.scope)` üzerinden gelir; "tüm kurumlar"
 * (merged) görünümünde yazma zaten `kurum.scope.mode === "single"` ile
 * kapatılır.
 */
export default async function PackagesPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/paketler");
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <PageHeader
        title="Paketler"
        description="Öğrenci kaydında seçilebilecek ders paketlerini yönetin — 30/40/50 dk süreye göre fiyatlandırma."
      />
      <PackageManager
        packages={data.packages ?? []}
        students={data.students}
        canWrite={kurum.scope.mode === "single"}
      />
    </div>
  );
}
