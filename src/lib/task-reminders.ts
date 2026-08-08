/**
 * İş Takip hatırlatma motoru — SAF sınıflandırma mantığı (I/O yok, store'dan
 * bağımsız test edilebilir). "Bu görev şu an bir DUE_SOON/DUE_TODAY/OVERDUE
 * hatırlatması hak ediyor mu" sorusuna, verilen bir "şimdi" anına ve kurum
 * saat dilimine göre TEK, merkezi bir yerden cevap verir — tick endpoint'i
 * ve testler AYNI fonksiyonu çağırır, mantık kopyalanmaz.
 */

import type { Task, TaskStatus } from "./types";
import { OPEN_TASK_STATUSES } from "./types";
import { toZonedYmd, zonedHour, calendarDaysBetween } from "./timezone";

export type TaskReminderKind = "DUE_SOON" | "DUE_TODAY" | "OVERDUE";

/** Son tarih günü, hangi yerel saatten SONRA "sabah oldu" sayılır (DUE_TODAY tetiklenir). */
export const DUE_TODAY_MORNING_HOUR = 8;

export type TaskReminderClassification = {
  kind: TaskReminderKind;
  /** Kurum saat diliminde "yyyy-MM-dd" — tekilleştirme anahtarının bir parçası. */
  calendarDay: string;
};

/**
 * Bir görevin şu an (varsa) hangi hatırlatmayı hak ettiğini saf olarak
 * hesaplar. Aday kuralları (madde 1):
 *   - status TODO/IN_PROGRESS/BLOCKED (COMPLETED/CANCELLED/ARCHIVED HARİÇ)
 *   - dueDate dolu olmalı
 * Zamanlama:
 *   - dueDate'in kurum-yerel takvim günü bugünden ÖNCEYSE → OVERDUE (günde en
 *     fazla 1 — çağıran taraf calendarDay'i tekilleştirme anahtarında kullanır).
 *   - dueDate'in kurum-yerel takvim günü BUGÜNSE → yalnızca yerel saat
 *     `DUE_TODAY_MORNING_HOUR`'dan SONRAYSA DUE_TODAY (sabah olmadıysa henüz
 *     hiçbir şey üretilmez — bir sonraki tick'te tekrar denenir, veri kaybı
 *     yok, yalnızca ERTELENMİŞ değerlendirme).
 *   - dueDate'in kurum-yerel takvim günü TAM OLARAK YARINSA → DUE_SOON
 *     ("son tarihten 24 saat önce" — bu uygulamada görevlerin yalnızca gün
 *     hassasiyetinde bir son tarihi var, saat bileşeni yok; bu yüzden "24
 *     saat önce" en doğru şekilde "son tarihten bir önceki takvim günü"
 *     olarak yorumlanır).
 *   - Bunların dışında (2+ gün kaldıysa) → null, hiçbir hatırlatma yok.
 */
export function classifyTaskReminder(
  task: Pick<Task, "status" | "dueDate">,
  nowUtc: Date,
  timeZone: string
): TaskReminderClassification | null {
  if (!isOpenStatus(task.status)) return null;
  if (!task.dueDate) return null;

  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return null;

  const dueDayYmd = toZonedYmd(dueDate, timeZone);
  const nowDayYmd = toZonedYmd(nowUtc, timeZone);
  const daysUntilDue = calendarDaysBetween(nowDayYmd, dueDayYmd);

  if (daysUntilDue < 0) {
    return { kind: "OVERDUE", calendarDay: nowDayYmd };
  }
  if (daysUntilDue === 0) {
    const hour = zonedHour(nowUtc, timeZone);
    if (hour < DUE_TODAY_MORNING_HOUR) return null; // henüz sabah olmadı — bir sonraki tick dener
    return { kind: "DUE_TODAY", calendarDay: nowDayYmd };
  }
  if (daysUntilDue === 1) {
    return { kind: "DUE_SOON", calendarDay: nowDayYmd };
  }
  return null;
}

function isOpenStatus(status: TaskStatus): boolean {
  return OPEN_TASK_STATUSES.includes(status);
}

/** Türkçe, kısa bildirim gövdesi — modül genelinde TEK metin kaynağı. */
export function buildTaskReminderText(kind: TaskReminderKind, taskTitle: string, taskId: string): { title: string; body: string } {
  const link = `/panel/is-takip/${taskId}`;
  switch (kind) {
    case "DUE_SOON":
      return {
        title: "Görev son tarihi yaklaşıyor",
        body: `"${taskTitle}" görevinin son tarihi yarın. Detay: ${link}`,
      };
    case "DUE_TODAY":
      return {
        title: "Görev bugün teslim",
        body: `"${taskTitle}" görevinin son tarihi bugün. Detay: ${link}`,
      };
    case "OVERDUE":
      return {
        title: "Görev gecikti",
        body: `"${taskTitle}" görevi gecikti. Detay: ${link}`,
      };
  }
}

/** Notification.kind alanına yazılan değer — task_assigned ile aynı isimlendirme ailesi. */
export function taskReminderNotificationKind(kind: TaskReminderKind): string {
  switch (kind) {
    case "DUE_SOON":
      return "task_due_soon";
    case "DUE_TODAY":
      return "task_due_today";
    case "OVERDUE":
      return "task_overdue";
  }
}
