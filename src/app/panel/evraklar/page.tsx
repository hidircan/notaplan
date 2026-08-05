import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { listDocumentTemplatesTool } from "@/lib/services";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui";
import { DocumentCreateForm } from "@/components/document-create-form";
import { readData } from "@/lib/store";

export const dynamic = "force-dynamic";

/** PRODUCT_BACKLOG §6 Faz 1 — Evraklar Merkezi */
export default async function DocumentsCenterPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/evraklar");
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const templatesResult = await listDocumentTemplatesTool(session);
  const templates = templatesResult.ok ? templatesResult.data.templates : [];
  const data = await readData();
  const students = data.students
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evraklar Merkezi"
        description="Şablondan belge üretimi, otomatik alanlar, sabit referans ve yazdırma (Faz 1)."
      />
      <Card>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-600">
          Şablonlar ({templates.length})
        </p>
        {templates.length === 0 ? (
          <EmptyState title="Şablon yok" />
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span>{t.name}</span>
                <Badge>{t.kind}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-600">
          Belge oluştur
        </p>
        <DocumentCreateForm
          templates={templates.map((t) => ({ id: t.id, name: t.name, kind: t.kind }))}
          students={students}
        />
      </Card>
    </div>
  );
}
