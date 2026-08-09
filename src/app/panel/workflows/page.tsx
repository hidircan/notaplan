import { PageHeader, Card, Badge } from "@/components/ui";
import { listWorkflowsForAdmin, listWorkflowRuns } from "@/lib/workflows";
import { requireSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import { WorkflowToggle } from "@/components/workflow-toggle";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  let ctx: Awaited<ReturnType<typeof requireSessionContext>>;
  try {
    ctx = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/workflows");
  }

  const [workflows, runs] = await Promise.all([
    listWorkflowsForAdmin(),
    listWorkflowRuns(ctx.tenantId, 20),
  ]);

  return (
    <div>
      <PageHeader title="Otonom Workflows" />

      <div className="space-y-4">
        {workflows.map((w) => (
          <Card key={w.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--color-text)] dark:text-slate-50">{w.name}</h2>
                  <Badge status={w.state.enabled ? "confirmed" : "cancelled"}>
                    {w.state.enabled ? "aktif" : "kapalı"}
                  </Badge>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    her {w.intervalMinutes} dk
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{w.description}</p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  id: <code className="font-mono">{w.id}</code>
                  {w.state.lastRunAt
                    ? ` · son: ${formatDateTime(w.state.lastRunAt)}`
                    : " · henüz çalışmadı"}
                  {typeof w.state.lastSuccess === "boolean"
                    ? w.state.lastSuccess
                      ? " · ✓"
                      : " · ✗"
                    : ""}
                  · koşu: {w.state.runCount}
                </p>
                {w.state.lastError ? (
                  <p className="mt-1 text-xs text-rose-600">{w.state.lastError}</p>
                ) : null}
              </div>
              <WorkflowToggle
                workflowId={w.id}
                enabled={w.state.enabled}
              />
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="font-semibold text-[var(--color-text)] dark:text-slate-50">Son çalıştırmalar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-xs uppercase text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">Workflow</th>
                <th className="px-3 py-2">Zaman</th>
                <th className="px-3 py-2">Süre</th>
                <th className="px-3 py-2">Adım</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                    Henüz çalıştırma yok. “Şimdi çalıştır” veya tick endpoint kullanın.
                  </td>
                </tr>
              ) : (
                runs.map((r, i) => (
                  <tr key={`${r.workflowId}-${r.startedAt}-${i}`} className="border-t border-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{r.workflowId}</td>
                    <td className="px-3 py-2 text-xs">{formatDateTime(r.finishedAt)}</td>
                    <td className="px-3 py-2 text-xs">{r.durationMs} ms</td>
                    <td className="px-3 py-2 text-xs">{r.steps.length}</td>
                    <td className="px-3 py-2">
                      <Badge status={r.success ? "completed" : "expired"}>
                        {r.success ? "ok" : "error"}
                      </Badge>
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
