/**
 * İş Takip Faz 3B-3B — yönetici görev raporu, saf agregasyon yardımcıları
 * (I/O yok, store'dan bağımsız test edilebilir — `task-calendar.ts`'nin
 * deseniyle tutarlı). Tenant/RBAC filtresi ÇAĞIRAN TARAFTA (tools.ts)
 * uygulanır; bu dosya yalnızca ZATEN tenant-scoped bir görev listesi
 * üzerinde sayım/gruplama yapar — hiçbir I/O, hiçbir ek sorgu.
 */
import type { Task, TaskCategory, TaskPriority, TaskStatus } from "./types";
import { OPEN_TASK_STATUSES } from "./types";
import { isTaskOverdue } from "./task-calendar";

export type TaskReportRange = { startYmd: string; endYmd: string };

export type TaskReportAssigneeRow = {
  assigneeId: string | null;
  open: number;
  overdue: number;
  completedInRange: number;
};

export type TaskReportCategoryRow = { category: TaskCategory; count: number };
export type TaskReportPriorityRow = { priority: TaskPriority; count: number };

export type TaskReport = {
  range: TaskReportRange;
  totalTasks: number;
  openWorkload: { todo: number; inProgress: number; blocked: number; total: number };
  overdueCount: number;
  /**
   * "Tamamlanma oranı" tanımı (UI'da da gösterilir):
   * pay = `completedInRange` (bu aralıkta `completedAt` düşen görevler),
   * payda = `dueInRange` (son tarihi bu aralığa düşen görevler — statüden
   * bağımsız). Payda 0 ise `ratePercent` `null` döner (0'a bölme yok,
   * UI "veri yok" gösterir).
   */
  completed: { inRange: number; dueInRange: number; ratePercent: number | null };
  /** Sorumlu bazında — `open`/`overdue` GÜNCEL durum (tarih aralığından bağımsız); `completedInRange` seçili aralığa göre. */
  byAssignee: TaskReportAssigneeRow[];
  /** Açık (TODO/IN_PROGRESS/BLOCKED) görevlerin kategori dağılımı — güncel durum, tarih aralığından bağımsız. */
  byCategory: TaskReportCategoryRow[];
  /** Açık görevlerin öncelik dağılımı — güncel durum, tarih aralığından bağımsız. */
  byPriority: TaskReportPriorityRow[];
};

function inYmdRange(ymd: string, range: TaskReportRange): boolean {
  return ymd >= range.startYmd && ymd <= range.endYmd;
}

/**
 * Tenant-scoped (çağıran tarafça zaten filtrelenmiş) bir görev listesinden
 * yönetici raporu üretir. Tek geçişte (`reduce` benzeri) hesaplanır — N+1
 * sorgu yok, ek I/O yok.
 */
export function buildTaskReport(tasks: Task[], range: TaskReportRange, todayYmd: string): TaskReport {
  const openWorkload = { todo: 0, inProgress: 0, blocked: 0, total: 0 };
  let overdueCount = 0;
  let completedInRange = 0;
  let dueInRange = 0;
  const byAssignee = new Map<string | null, TaskReportAssigneeRow>();
  const byCategory = new Map<TaskCategory, number>();
  const byPriority = new Map<TaskPriority, number>();

  function assigneeRow(assigneeId: string | null): TaskReportAssigneeRow {
    let row = byAssignee.get(assigneeId);
    if (!row) {
      row = { assigneeId, open: 0, overdue: 0, completedInRange: 0 };
      byAssignee.set(assigneeId, row);
    }
    return row;
  }

  for (const t of tasks) {
    const isOpen = (OPEN_TASK_STATUSES as TaskStatus[]).includes(t.status);
    const overdue = isTaskOverdue(t, todayYmd);
    const assigneeKey = t.assigneeId ?? null;

    if (isOpen) {
      if (t.status === "TODO") openWorkload.todo += 1;
      else if (t.status === "IN_PROGRESS") openWorkload.inProgress += 1;
      else if (t.status === "BLOCKED") openWorkload.blocked += 1;
      openWorkload.total += 1;

      assigneeRow(assigneeKey).open += 1;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1);
      byPriority.set(t.priority, (byPriority.get(t.priority) ?? 0) + 1);
    }

    if (overdue) {
      overdueCount += 1;
      assigneeRow(assigneeKey).overdue += 1;
    }

    if (t.completedAt && inYmdRange(t.completedAt.slice(0, 10), range)) {
      completedInRange += 1;
      assigneeRow(assigneeKey).completedInRange += 1;
    }

    if (t.dueDate && inYmdRange(t.dueDate.slice(0, 10), range)) {
      dueInRange += 1;
    }
  }

  return {
    range,
    totalTasks: tasks.length,
    openWorkload,
    overdueCount,
    completed: {
      inRange: completedInRange,
      dueInRange,
      ratePercent: dueInRange > 0 ? Math.round((completedInRange / dueInRange) * 1000) / 10 : null,
    },
    byAssignee: Array.from(byAssignee.values()).sort((a, b) => b.open - a.open || b.overdue - a.overdue),
    byCategory: Array.from(byCategory.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    byPriority: Array.from(byPriority.entries())
      .map(([priority, count]) => ({ priority, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Varsayılan aralık: bugün dahil son 30 gün (bugün-29 .. bugün), tenant saat dilimine göre çözülmüş `todayYmd` üzerinden. */
export function defaultTaskReportRange(todayYmd: string): TaskReportRange {
  const [y, m, d] = todayYmd.split("-").map(Number);
  const start = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 29));
  const startYmd = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(
    start.getUTCDate()
  ).padStart(2, "0")}`;
  return { startYmd, endYmd: todayYmd };
}
