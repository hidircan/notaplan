import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/audit/log";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = {
  success: "Başarılı",
  denied: "Reddedildi",
  error: "Hata",
};

/**
 * Denetim Kaydı — kim, ne zaman, hangi ekranda/varlıkta hangi kritik
 * işlemi yaptı (audit trail). Veri kaynağı zaten mevcuttu
 * (src/lib/audit/log.ts `recordAuditLog`/`listAuditLogs`, tüm kritik
 * yazma işlemlerinde — ödeme, telafi, öğretmen ücreti, öğrenci verisi vb.
 * — zaten çağrılıyordu); yalnızca bu ekran eksikti. Yalnızca
 * STORE_MODE=db'de kalıcı olur (bkz. listAuditLogs dosya başı notu) —
 * json/memory modda boş liste döner, hata fırlatmaz.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string }>;
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

  const sp = await searchParams;
  const logs = await listAuditLogs(session.tenantId, {
    limit: 200,
    action: sp.action || undefined,
    entityType: sp.entityType || undefined,
  });

  return (
    <div>
      <PageHeader title="Denetim Kaydı" />

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
                  Henüz denetim kaydı yok (yalnızca üretim veritabanı modunda tutulur).
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
