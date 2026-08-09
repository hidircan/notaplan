import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { listInstrumentCatalogTool } from "@/lib/services";
import { PageHeader } from "@/components/ui";
import { InstrumentCatalogManager } from "@/components/instrument-catalog-manager";

export const dynamic = "force-dynamic";

/**
 * ÖNCELİK 4 (devam) — Yönetilebilir Enstrüman Kataloğu. Salt okuma her
 * personel rolüne açık (listInstrumentCatalogTool RBAC'ı), ama bu YÖNETİM
 * ekranı yalnızca admin roller için görünür/işlevsel — diğer roller
 * `canManage=false` ile salt-okunur bir görünüm alır.
 */
export default async function InstrumentCatalogPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/enstrumanlar");
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const result = await listInstrumentCatalogTool(session, {});
  const entries = result.ok ? result.data.entries : [];

  return (
    <div>
      <PageHeader title="Enstrümanlar" />
      <InstrumentCatalogManager entries={entries} canWrite />
    </div>
  );
}
