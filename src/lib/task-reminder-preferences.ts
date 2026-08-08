/**
 * İş Takip hatırlatma tercihleri — kullanıcı+tenant başına 3 toggle
 * (DUE_SOON/DUE_TODAY/OVERDUE). Kayıt yoksa varsayılan ÜÇÜ DE açık (madde 4).
 * Aynı desen: src/lib/tasks.ts (STORE_MODE=db → Prisma, json/memory → tek dosya).
 */

import path from "path";
import { isDbMode, resolveDataDir } from "./config";
import { uid } from "./utils";

const FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "task-reminder-preferences.json");

export const TASK_REMINDER_PREFERENCES_FILE = FILE;

export type TaskReminderPreference = {
  dueSoonEnabled: boolean;
  dueTodayEnabled: boolean;
  overdueEnabled: boolean;
};

export const DEFAULT_TASK_REMINDER_PREFERENCE: TaskReminderPreference = {
  dueSoonEnabled: true,
  dueTodayEnabled: true,
  overdueEnabled: true,
};

type StoredPreference = TaskReminderPreference & { id: string; tenantId: string; userId: string; updatedAt: string };

async function loadAll(): Promise<StoredPreference[]> {
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as StoredPreference[];
  } catch {
    return [];
  }
}

async function saveAll(rows: StoredPreference[]): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

/** Kayıt yoksa varsayılanı (üçü de açık) döner — asla null/undefined, çağıran taraf hep somut bir tercih görür. */
export async function getReminderPreference(tenantId: string, userId: string): Promise<TaskReminderPreference> {
  if (isDbMode) {
    const { prisma } = await import("./db");
    const row = await prisma.taskReminderPreference.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!row) return { ...DEFAULT_TASK_REMINDER_PREFERENCE };
    return {
      dueSoonEnabled: row.dueSoonEnabled,
      dueTodayEnabled: row.dueTodayEnabled,
      overdueEnabled: row.overdueEnabled,
    };
  }
  const all = await loadAll();
  const found = all.find((r) => r.tenantId === tenantId && r.userId === userId);
  if (!found) return { ...DEFAULT_TASK_REMINDER_PREFERENCE };
  return {
    dueSoonEnabled: found.dueSoonEnabled,
    dueTodayEnabled: found.dueTodayEnabled,
    overdueEnabled: found.overdueEnabled,
  };
}

export async function setReminderPreference(
  tenantId: string,
  userId: string,
  patch: TaskReminderPreference
): Promise<TaskReminderPreference> {
  if (isDbMode) {
    const { prisma } = await import("./db");
    const row = await prisma.taskReminderPreference.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { id: uid("trp"), tenantId, userId, ...patch },
      update: { ...patch },
    });
    return {
      dueSoonEnabled: row.dueSoonEnabled,
      dueTodayEnabled: row.dueTodayEnabled,
      overdueEnabled: row.overdueEnabled,
    };
  }
  const all = await loadAll();
  const idx = all.findIndex((r) => r.tenantId === tenantId && r.userId === userId);
  const now = new Date().toISOString();
  if (idx === -1) {
    const record: StoredPreference = { id: uid("trp"), tenantId, userId, ...patch, updatedAt: now };
    await saveAll([...all, record]);
    return patch;
  }
  const updated: StoredPreference = { ...all[idx]!, ...patch, updatedAt: now };
  const next = [...all];
  next[idx] = updated;
  await saveAll(next);
  return patch;
}

/** Demo/kurulum sıfırlaması için — tenant'ın tüm hatırlatma tercihlerini siler. */
export async function clearReminderPreferences(tenantId: string): Promise<void> {
  if (isDbMode) {
    const { prisma } = await import("./db");
    await prisma.taskReminderPreference.deleteMany({ where: { tenantId } });
    return;
  }
  const all = await loadAll();
  const remaining = all.filter((r) => r.tenantId !== tenantId);
  if (remaining.length !== all.length) await saveAll(remaining);
}
