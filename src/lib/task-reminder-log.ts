/**
 * İş Takip hatırlatma TEKİLLEŞTİRME kaydı — aynı desen: src/lib/tasks.ts /
 * teacher-availability.ts (STORE_MODE=db → Prisma, json/memory → tek dosya).
 *
 * `recordReminderIfNew` tek giriş noktasıdır: (tenantId, taskId,
 * assigneeUserId, kind, calendarDay) beşlisi için BENZERSİZ bir kayıt
 * oluşturmayı DENER — zaten varsa `false` döner (bildirim ÜRETİLMEMELİ,
 * zaten gönderilmiş), yeni oluşturulduysa `true` döner (bildirim şimdi
 * üretilebilir). db modunda gerçek bir UNIQUE INDEX + `create()` hata
 * yakalama ile (yarış durumuna karşı da güvenli); json/memory modunda bu
 * store'un tüm yazmaları zaten tek Node process içinde SIRALI (aynı
 * teacher-availability.ts/tasks.ts deseni) — check-then-insert güvenlidir.
 */

import path from "path";
import { isDbMode, resolveDataDir } from "./config";
import { uid } from "./utils";
import type { TaskReminderKind } from "./task-reminders";

const FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "task-reminder-log.json");

export const TASK_REMINDER_LOG_FILE = FILE;

type StoredReminderLog = {
  id: string;
  tenantId: string;
  taskId: string;
  assigneeUserId: string;
  kind: TaskReminderKind;
  calendarDay: string;
  createdAt: string;
};

async function loadAll(): Promise<StoredReminderLog[]> {
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as StoredReminderLog[];
  } catch {
    return [];
  }
}

async function saveAll(rows: StoredReminderLog[]): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

export type RecordReminderInput = {
  tenantId: string;
  taskId: string;
  assigneeUserId: string;
  kind: TaskReminderKind;
  calendarDay: string;
};

/**
 * Bu tam kombinasyon için DAHA ÖNCE bir kayıt yoksa oluşturur ve `true`
 * döner (bildirim üretilmeli); zaten varsa hiçbir şey yapmaz, `false`
 * döner (atla — tekilleştirme).
 */
export async function recordReminderIfNew(input: RecordReminderInput): Promise<boolean> {
  if (isDbMode) {
    const { prisma } = await import("./db");
    try {
      await prisma.taskReminderLog.create({
        data: {
          id: uid("remind"),
          tenantId: input.tenantId,
          taskId: input.taskId,
          assigneeUserId: input.assigneeUserId,
          kind: input.kind,
          calendarDay: input.calendarDay,
        },
      });
      return true;
    } catch (e) {
      // P2002 = unique constraint violation → zaten kaydedilmiş, sessizce atla.
      const code = (e as { code?: string } | null)?.code;
      if (code === "P2002") return false;
      throw e;
    }
  }
  const all = await loadAll();
  const exists = all.some(
    (r) =>
      r.tenantId === input.tenantId &&
      r.taskId === input.taskId &&
      r.assigneeUserId === input.assigneeUserId &&
      r.kind === input.kind &&
      r.calendarDay === input.calendarDay
  );
  if (exists) return false;
  const record: StoredReminderLog = { id: uid("remind"), ...input, createdAt: new Date().toISOString() };
  await saveAll([...all, record]);
  return true;
}

/** Demo/kurulum sıfırlaması + testler için — tenant'ın tüm hatırlatma kayıtlarını siler. */
export async function clearTaskReminderLog(tenantId: string): Promise<void> {
  if (isDbMode) {
    const { prisma } = await import("./db");
    await prisma.taskReminderLog.deleteMany({ where: { tenantId } });
    return;
  }
  const all = await loadAll();
  const remaining = all.filter((r) => r.tenantId !== tenantId);
  if (remaining.length !== all.length) await saveAll(remaining);
}
