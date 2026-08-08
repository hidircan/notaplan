import { PageHeader, Card, Badge } from "@/components/ui";
import { listMemoriesForAdmin } from "@/lib/ai/memory";
import { requireSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { MemoryDeleteButton } from "@/components/memory-delete-button";

export const dynamic = "force-dynamic";

export default async function AiMemoryPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/ai/memory");
  }

  const memories = await listMemoriesForAdmin(session.tenantId, 150);

  const byScope = {
    conversation: memories.filter((m) => m.scope === "conversation").length,
    user: memories.filter((m) => m.scope === "user").length,
    tenant: memories.filter((m) => m.scope === "tenant").length,
    workflow: memories.filter((m) => m.scope === "workflow").length,
  };

  return (
    <div>
      <PageHeader
        title="AI Memory"
        actions={
          <Link
            href="/panel/ai"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            AI Dashboard
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {(
          [
            ["conversation", byScope.conversation],
            ["user", byScope.user],
            ["tenant", byScope.tenant],
            ["workflow", byScope.workflow],
          ] as const
        ).map(([label, n]) => (
          <Card key={label} className="!py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{n}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Kapsam</th>
              <th className="px-3 py-2">Tür</th>
              <th className="px-3 py-2">İçerik</th>
              <th className="px-3 py-2">Güncelleme</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {memories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  Bellek boş. AI sohbeti veya workflow çalıştırın.
                </td>
              </tr>
            ) : (
              memories.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 align-top dark:border-slate-800">
                  <td className="px-3 py-2">
                    <Badge>{m.scope}</Badge>
                    <span className="mt-1 block max-w-[100px] truncate font-mono text-[10px] text-slate-400">
                      {m.scopeKey}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{m.kind}</td>
                  <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                    <p className="max-w-md whitespace-pre-wrap">{m.content}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400">
                    {formatDateTime(m.updatedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <MemoryDeleteButton id={m.id} />
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
