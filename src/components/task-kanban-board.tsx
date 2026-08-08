"use client";

/**
 * İş Takip Kanban görünümü — 5 sütun (Yapılacak/Devam Ediyor/Beklemede/
 * Tamamlandı/İptal Edildi; Arşiv kanbanda gösterilmez, ayrı bir filtredir).
 *
 * Sürükle-bırak YERİNE bilinçli olarak erişilebilir bir "Durumu değiştir"
 * menüsü kullanılır — klavye/ekran okuyucuyla da kullanılabilir, native DnD
 * kırılganlığı (mobil dokunmatik, erişilebilirlik) olmadan aynı işi görür.
 * Her değişiklik AYNI `actionChangeTaskStatus` server action'ını (dolayısıyla
 * AYNI RBAC/audit/aktivite kaydı zincirini) çağırır — Kanban için paralel
 * bir yetki/duruma-geçiş mantığı YOK. Sunucu bir geçişi reddederse (ör.
 * TEACHER CANCELLED'a taşımaya çalışırsa) kart eski sütununda kalır ve
 * hata mesajı gösterilir.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { actionChangeTaskStatus } from "@/lib/actions";
import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { Task, TaskStatus } from "@/lib/types";

type Column = { status: TaskStatus; label: string };

const COLUMNS: Column[] = [
  { status: "TODO", label: "Yapılacak" },
  { status: "IN_PROGRESS", label: "Devam Ediyor" },
  { status: "BLOCKED", label: "Beklemede" },
  { status: "COMPLETED", label: "Tamamlandı" },
  { status: "CANCELLED", label: "İptal Edildi" },
];

/** Kanban'da hedef sütuna göre hangi changeTaskStatusTool aksiyonunun çağrılacağı — tek kaynak burada, tools.ts'teki semantiğin AYNISI. */
function actionForTarget(target: TaskStatus): { action: "complete" | "cancel" | "set_status"; status?: TaskStatus } {
  if (target === "COMPLETED") return { action: "complete" };
  if (target === "CANCELLED") return { action: "cancel" };
  return { action: "set_status", status: target };
}

const DETAIL_HREF_PREFIX_ADMIN = "/panel/is-takip/";
const DETAIL_HREF_PREFIX_TEACHER = "/ogretmen/is-takip/";

export function TaskKanbanBoard({
  tasks,
  isAdmin,
  assigneeLabels,
}: {
  tasks: Task[];
  isAdmin: boolean;
  /** taskId -> sorumlu görünen adı (ham ID göstermemek için, bkz. personel dizini). */
  assigneeLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const detailPrefix = isAdmin ? DETAIL_HREF_PREFIX_ADMIN : DETAIL_HREF_PREFIX_TEACHER;
  const todayYmd = new Date().toISOString().slice(0, 10);

  function onChangeStatus(taskId: string, target: TaskStatus) {
    setError(null);
    setPendingId(taskId);
    const { action, status } = actionForTarget(target);
    startTransition(async () => {
      const result = await actionChangeTaskStatus({ taskId, action, status });
      setPendingId(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-md bg-[#f8ecec] px-3 py-2 text-xs font-medium text-[#6b2424]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="min-w-0">
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-[var(--color-text)]">
                {col.label}
                <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                  {colTasks.length}
                </span>
              </h2>
              <div className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-center text-xs text-[var(--color-text-muted)]">
                    Görev yok
                  </p>
                ) : (
                  colTasks.map((t) => {
                    const overdue =
                      t.dueDate &&
                      t.dueDate.slice(0, 10) < todayYmd &&
                      t.status !== "COMPLETED" &&
                      t.status !== "CANCELLED";
                    return (
                      <Card key={t.id} className="!p-3">
                        <Link href={`${detailPrefix}${t.id}`} className="block">
                          <p className="text-sm font-medium text-[var(--color-text)] hover:underline">{t.title}</p>
                        </Link>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {t.category} · {assigneeLabels[t.assigneeId ?? ""] ?? "Atanmadı"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge status={t.priority === "URGENT" || t.priority === "HIGH" ? "overdue" : "pending"}>
                            {t.priority}
                          </Badge>
                          {overdue ? <Badge status="overdue">Gecikmiş</Badge> : null}
                          {t.dueDate ? (
                            <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(t.dueDate)}</span>
                          ) : null}
                        </div>
                        <label className="mt-2 block">
                          <span className="sr-only">{t.title} — durumu değiştir</span>
                          <select
                            value={t.status}
                            disabled={pendingId === t.id}
                            onChange={(e) => onChangeStatus(t.id, e.target.value as TaskStatus)}
                            className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-xs"
                            aria-label={`${t.title} durumu`}
                          >
                            {COLUMNS.map((c) => (
                              <option key={c.status} value={c.status}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
