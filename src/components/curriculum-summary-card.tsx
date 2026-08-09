import { Card, EmptyState, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export type CurriculumSummaryItem = {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
  updatedAt: string;
};

/** Veli/öğrenci salt-okunur müfredat özeti — not/history yok. */
export function CurriculumSummaryCard({
  overallPercent,
  progressExplanation,
  topics,
}: {
  overallPercent: number;
  progressExplanation: string;
  topics: CurriculumSummaryItem[];
}) {
  return (
    <section aria-labelledby="curriculum-summary-heading" className="space-y-2">
      <Card className="!p-4">
        <div className="flex items-center justify-between">
          <h2 id="curriculum-summary-heading" className="text-sm font-semibold text-[var(--color-text)]">
            Müfredat ilerlemesi
          </h2>
          <p className="text-lg font-semibold text-amber-700" aria-label="Genel ilerleme">
            %{overallPercent}
          </p>
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{progressExplanation}</p>
      </Card>

      {topics.length === 0 ? (
        <EmptyState title="Henüz konu yok" description="Öğretmen konu hedefleri eklediğinde burada görünür." />
      ) : (
        topics.map((t) => (
          <Card key={t.id} className="!p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">{t.title}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">Güncellendi: {formatDate(t.updatedAt)}</p>
              </div>
              <div className="text-right">
                <Badge status={t.status}>{t.status}</Badge>
                <p className="mt-0.5 text-sm font-semibold text-amber-700">%{t.progressPercent}</p>
              </div>
            </div>
          </Card>
        ))
      )}
    </section>
  );
}
