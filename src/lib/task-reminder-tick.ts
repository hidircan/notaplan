/**
 * İş Takip hatırlatma tick motoru — tenant'lar arası dolaşır, her tenant'ta
 * açık (TODO/IN_PROGRESS/BLOCKED) görevleri sınıflandırır
 * (`classifyTaskReminder`) ve hak edilen bir hatırlatma varsa
 * `notifyTaskReminder`'ı çağırır (tercih + tekilleştirme + aktiflik
 * kontrolleri ORADA yapılır, burada TEKRARLANMAZ).
 *
 * Bu SAF bir orkestrasyon katmanıdır — `/api/v1/tasks/reminders/tick`
 * route'u (kimlik doğrulama/secret kontrolü) BU fonksiyonu çağırır; motor
 * kendisi hiçbir kimlik doğrulaması yapmaz (o route'un işi), böylece bu
 * fonksiyon izole test edilebilir (bkz. task-reminder-tick.test.ts).
 */

import { listTenants } from "./store";
import { listTasks } from "./tasks";
import { classifyTaskReminder } from "./task-reminders";
import { notifyTaskReminder } from "./task-notifications";
import { resolveAppTimezone } from "./timezone";
import { runWithTenantAsync } from "./tenant-context";
import { OPEN_TASK_STATUSES } from "./types";

/** Makul üst sınırlar — tek bir tick çalışması sonsuz/aşırı büyük bir batch'e dönüşmesin. */
export const MAX_TENANTS_PER_TICK = 200;
export const MAX_TASKS_PER_TENANT_PER_TICK = 500;
/** Hata mesajı listesi de sınırsız büyümesin — özet sayaçlar (errors) tam, detaylar ilk N ile sınırlı. */
const MAX_ERROR_DETAILS = 20;

export type TaskReminderTickSummary = {
  tenantsProcessed: number;
  tasksEvaluated: number;
  remindersCreated: number;
  duplicatesSkipped: number;
  /** Aday değil (assignee/dueDate yok, kapsam dışı statü, henüz zamanı gelmedi, aktif değil, tercih kapalı). */
  skipped: number;
  errors: number;
  errorDetails: string[];
};

function emptySummary(): TaskReminderTickSummary {
  return {
    tenantsProcessed: 0,
    tasksEvaluated: 0,
    remindersCreated: 0,
    duplicatesSkipped: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };
}

function pushError(summary: TaskReminderTickSummary, message: string) {
  summary.errors++;
  if (summary.errorDetails.length < MAX_ERROR_DETAILS) summary.errorDetails.push(message);
}

/**
 * Tüm tenant'lar için bir hatırlatma tick'i çalıştırır. Bir tenant'ın veya
 * bir görevin hata vermesi diğerlerini DURDURMAZ (her seviyede try/catch) —
 * `errors` sayacı artar, batch devam eder.
 */
export async function runTaskReminderTick(now: Date = new Date()): Promise<TaskReminderTickSummary> {
  const summary = emptySummary();

  let tenants: { tenantId: string; name: string }[] = [];
  try {
    tenants = await listTenants();
  } catch (e) {
    pushError(summary, `listTenants: ${e instanceof Error ? e.message : String(e)}`);
    return summary;
  }

  for (const tenant of tenants.slice(0, MAX_TENANTS_PER_TICK)) {
    try {
      await runWithTenantAsync(tenant.tenantId, async () => {
        const tasks = await listTasks(tenant.tenantId, { status: OPEN_TASK_STATUSES });
        // Kurum bazlı bir timezone ayarı henüz yok (bkz. timezone.ts) —
        // merkezi tek uygulama varsayılanı kullanılır, her tenant için aynı
        // fonksiyon çağrılır (ileride kurum ayarı eklenirse tek satırlık
        // değişiklikle buraya akar).
        const timeZone = resolveAppTimezone();

        for (const task of tasks.slice(0, MAX_TASKS_PER_TENANT_PER_TICK)) {
          summary.tasksEvaluated++;
          try {
            if (!task.assigneeId || !task.dueDate) {
              summary.skipped++;
              continue;
            }
            const classification = classifyTaskReminder(task, now, timeZone);
            if (!classification) {
              summary.skipped++;
              continue;
            }
            const result = await notifyTaskReminder({
              tenantId: tenant.tenantId,
              taskId: task.id,
              taskTitle: task.title,
              assigneeId: task.assigneeId,
              kind: classification.kind,
              calendarDay: classification.calendarDay,
            });
            if (result === "created") summary.remindersCreated++;
            else if (result === "duplicate") summary.duplicatesSkipped++;
            else summary.skipped++;
          } catch (e) {
            pushError(summary, `tenant=${tenant.tenantId} task=${task.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      });
      summary.tenantsProcessed++;
    } catch (e) {
      pushError(summary, `tenant=${tenant.tenantId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return summary;
}
