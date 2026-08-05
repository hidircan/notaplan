import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { listDocumentTemplatesTool, listDocumentInstancesTool } from "@/lib/services";
import { documentKindLabel } from "@/lib/documents";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DocumentCreateForm } from "@/components/document-create-form";
import { DocumentsTable, type DocumentRow } from "@/components/documents-table";
import { readData } from "@/lib/store";

export const dynamic = "force-dynamic";

/** PRODUCT_BACKLOG §6 — Evraklar Merkezi: profesyonel doküman merkezi görünümü. */
export default async function DocumentsCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { studentId } = await searchParams;
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/evraklar");
  }
  if (session.role !== "SCHOOL_ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/panel");
  }

  const [templatesResult, documentsResult, data] = await Promise.all([
    listDocumentTemplatesTool(session),
    listDocumentInstancesTool(session, studentId ? { studentId } : {}),
    readData(),
  ]);
  const templates = templatesResult.ok ? templatesResult.data.templates : [];
  const documents = documentsResult.ok ? documentsResult.data.documents : [];
  const students = data.students.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }));

  const draftCount = documents.filter((d) => d.status === "draft").length;
  const sentForSignatureCount = documents.filter((d) => d.status === "sent_for_signature").length;
  const signedOrUploadedCount = documents.filter((d) => d.status === "signed" || d.status === "uploaded").length;
  const expiredCount = documents.filter((d) => d.status === "expired").length;

  const rows: DocumentRow[] = documents.map((d) => {
    const person =
      (d.studentId && data.students.find((s) => s.id === d.studentId)?.name) ||
      (d.teacherId && data.teachers.find((t) => t.id === d.teacherId)?.name) ||
      "—";
    const branchName = d.branchId ? data.settings.branches.find((b) => b.id === d.branchId)?.shortName : undefined;
    return {
      id: d.id,
      reference: d.reference,
      kindLabel: documentKindLabel(d.kind),
      personName: person,
      branchName,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });

  return (
    <div>
      <PageHeader
        title="Evraklar Merkezi"
        description="Belge oluşturma, yazdırma ve imzalı sürüm takibi — kurumun doküman operasyon merkezi."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Taslak" value={draftCount} accent="warning" />
        <StatCard label="İmzaya Verildi" value={sentForSignatureCount} accent="info" />
        <StatCard label="İmzalandı / Yüklendi" value={signedOrUploadedCount} accent="success" />
        <StatCard label="Süresi Dolan" value={expiredCount} accent="danger" />
      </div>

      <Card className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-primary)]">
          Yeni Evrak Oluştur
        </p>
        {templates.length === 0 ? (
          <EmptyState title="Şablon yok" description="Kurulum ekranından belge şablonlarını etkinleştirin." />
        ) : (
          <DocumentCreateForm
            templates={templates.map((t) => ({ id: t.id, name: t.name, kind: t.kind }))}
            students={students}
          />
        )}
      </Card>

      {documents.length === 0 ? (
        <EmptyState
          title="Henüz evrak yok"
          description="Yukarıdaki 'Yeni Evrak Oluştur' bölümünden ilk belgenizi oluşturun — referans, tarih ve kişi/kurum alanları otomatik doldurulur."
        />
      ) : (
        <DocumentsTable rows={rows} />
      )}
    </div>
  );
}
