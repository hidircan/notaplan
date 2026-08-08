/**
 * İş Takip takvim görünümü — saf gruplama yardımcıları (I/O yok, store'dan
 * bağımsız test edilebilir, `attendance-calendar.ts`'nin ay-günü üretme
 * deseniyle tutarlı ama KOPYALA-YAPIŞTIR değil — tasks burada dönem/akademik
 * yıl kavramına bağlı değildir, düz takvim ayı kullanılır).
 */
import type { Task } from "./types";

export type TaskCalendarDay = {
  /** yyyy-MM-dd */
  date: string;
  tasks: Task[];
};

export type TaskCalendarMonth = {
  year: number;
  month: number; // 1-12
  days: TaskCalendarDay[];
  /** Son tarihi olmayan görevler — ayrı bir bölümde gösterilir, hiçbir günde kaybolmaz. */
  undated: Task[];
};

/**
 * Verilen ay için gün gün görev gruplaması + son tarihi olmayanlar.
 * `tasks` çağıran tarafça ZATEN tenant/RBAC'e göre filtrelenmiş olmalı
 * (bkz. listTasksTool) — bu fonksiyon yalnızca gruplama yapar, yetki
 * kontrolü yapmaz.
 */
export function groupTasksForCalendarMonth(tasks: Task[], year: number, month: number): TaskCalendarMonth {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: TaskCalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({
      date: ymd,
      tasks: tasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === ymd),
    });
  }
  const undated = tasks.filter((t) => !t.dueDate);
  return { year, month, days, undated };
}

/** Bir görev "gecikmiş" mi — son tarihi bugünden önce VE hâlâ açık bir statüde. */
export function isTaskOverdue(task: Pick<Task, "dueDate" | "status">, todayYmd: string): boolean {
  if (!task.dueDate) return false;
  if (task.status === "COMPLETED" || task.status === "CANCELLED" || task.status === "ARCHIVED") return false;
  return task.dueDate.slice(0, 10) < todayYmd;
}
