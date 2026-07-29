import { PageHeader, Card, Badge } from "@/components/ui";
import { listAiExecutions } from "@/lib/ai/metrics";
import { requireSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AiLogsPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/ai/logs");
  }

  const logs = await listAiExecutions({ tenantId: session.tenantId, limit: 150 });

  return (
    <div>
      <PageHeader
        title="AI Logları"
        description="Her plan / tool / narrate yürütmesi tenant bazında kaydedilir."
        actions={
          <Link
            href="/panel/ai"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Dashboard
          </Link>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Zaman</th>
                <th className="px-3 py-2">Faz</th>
                <th className="px-3 py-2">Tool</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Süre</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Conv / User</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    Kayıt yok. AI Asistan ile bir sohbet başlatın.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                      {formatDateTime(log.at)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge>{log.phase}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{log.toolName || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {log.provider}
                      <span className="block text-[10px] text-slate-400">{log.model}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{log.durationMs} ms</td>
                    <td className="px-3 py-2">
                      <Badge status={log.success ? "completed" : "expired"}>
                        {log.success ? "ok" : "error"}
                      </Badge>
                      {!log.success && log.error ? (
                        <span className="mt-0.5 block max-w-[180px] truncate text-[10px] text-rose-600">
                          {log.error}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-500">
                      <div className="max-w-[120px] truncate">{log.conversationId || "—"}</div>
                      <div className="truncate">{log.userId}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
