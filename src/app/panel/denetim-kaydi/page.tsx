import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext } from "@/lib/institution/context";
import { listAuditLogs, type AuditOutcome } from "@/lib/audit/log";
import { KurumScopeNote } from "@/components/kurum-scope-note";
import { Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = {
  success: "Başarılı",
  denied: "Reddedildi",
  error: "Hata",
};

const ROLE_OPTIONS = ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "AI_AGENT"];

/**
 * Denetim Kaydı — kim, ne zaman, hangi ekranda/varlıkta hangi kritik
 * işlemi yaptı (audit trail). Veri kaynağı `src/lib/audit/log.ts`
 * (recordAuditLog/listAuditLogs) — tüm kritik yazma işlemlerinde zaten
 * çağrılıyordu. Yalnızca STORE_MODE=db'de kalıcı olur; json/memory modda
 * boş liste döner, hata fırlatmaz.
 *
 * Filtreler URL query param'larında tutulur (?from=&to=&actorUserId=&
 * actorRole=&action=&entityType=&outcome=&q=) — kalıcı, paylaşılabilir ve
 * geri/ileri tuşlarıyla uyumlu (theme/sidebar tercihi gibi localStorage
 * değil, bilinçli olarak URL — bir denetim sorgusu link olarak
 * paylaşılabilmeli).
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    actorUserId?: string;
    actorRole?: string;
    action?: string;
    entityType?: string;
    outcome?: string;
    q?: string;
  }>;
}) {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/denetim-kaydi");
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const kurum = await getInstitutionContext(session);
  const sp = await searchParams;
  const tenantIds = kurum.scope.mode === "all" ? kurum.scope.tenantIds : [kurum.scope.tenantId];

  const filters = {
    from: sp.from || undefined,
    to: sp.to || undefined,
    actorUserId: sp.actorUserId || undefined,
    actorRole: sp.actorRole || undefined,
    action: sp.action || undefined,
    entityType: sp.entityType || undefined,
    outcome: (sp.outcome as AuditOutcome) || undefined,
    search: sp.q || undefined,
    limit: 200,
  };

  const perTenantLogs = await Promise.all(tenantIds.map((tid) => listAuditLogs(tid, filters)));
  const logs = perTenantLogs.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 200);

  const actionOptions = Array.from(new Set(logs.map((l) => l.action))).sort();
  const entityTypeOptions = Array.from(new Set(logs.map((l) => l.entityType))).sort();

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <PageHeader title="Denetim Kaydı" />

      <Card className="mb-6">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Başlangıç tarihi</Label>
            <Input type="date" name="from" defaultValue={sp.from ?? ""} />
          </div>
          <div>
            <Label>Bitiş tarihi</Label>
            <Input type="date" name="to" defaultValue={sp.to ?? ""} />
          </div>
          <div>
            <Label>Kullanıcı (ID)</Label>
            <Input name="actorUserId" defaultValue={sp.actorUserId ?? ""} placeholder="Kullanıcı ID" />
          </div>
          <div>
            <Label>Rol</Label>
            <Select name="actorRole" defaultValue={sp.actorRole ?? ""}>
              <option value="">Tümü</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>İşlem türü</Label>
            <Input name="action" list="action-options" defaultValue={sp.action ?? ""} placeholder="ör. payment.mark_paid" />
            <datalist id="action-options">
              {actionOptions.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Varlık türü / kaynak</Label>
            <Input name="entityType" list="entity-type-options" defaultValue={sp.entityType ?? ""} placeholder="ör. Payment" />
            <datalist id="entity-type-options">
              {entityTypeOptions.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Durum</Label>
            <Select name="outcome" defaultValue={sp.outcome ?? ""}>
              <option value="">Tümü</option>
              <option value="success">Başarılı</option>
              <option value="denied">Reddedildi</option>
              <option value="error">Hata</option>
            </Select>
          </div>
          <div>
            <Label>Ara</Label>
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="İşlem, varlık, kullanıcı ID..." />
          </div>
          <div className="col-span-full flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
            >
              Filtrele
            </button>
            <a
              href="/panel/denetim-kaydi"
              className="rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            >
              Temizle
            </a>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Zaman</th>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">İşlem</th>
              <th className="px-4 py-3">Varlık</th>
              <th className="px-4 py-3">Sonuç</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Bu filtrelerle eşleşen denetim kaydı yok (yalnızca üretim veritabanı modunda tutulur).
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--color-border)] align-top">
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{formatDateTime(log.createdAt.toISOString())}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">{log.actorUserId}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{log.actorRole}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text)]">{log.action}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {log.entityType} · {log.entityId}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        log.outcome === "success"
                          ? "font-medium text-emerald-700"
                          : log.outcome === "denied"
                            ? "font-medium text-amber-700"
                            : "font-medium text-rose-700"
                      }
                    >
                      {OUTCOME_LABEL[log.outcome] ?? log.outcome}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
