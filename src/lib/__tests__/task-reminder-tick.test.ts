import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { createTaskTool, updateTaskTool, archiveTeacherTool, createTeacherTool } from "../services/tools";
import { TASKS_FILE } from "../tasks";
import { NOTIFICATIONS_FILE, listAllNotifications } from "../notifications";
import { TASK_REMINDER_LOG_FILE } from "../task-reminder-log";
import { TASK_REMINDER_PREFERENCES_FILE, setReminderPreference } from "../task-reminder-preferences";
import { runTaskReminderTick } from "../task-reminder-tick";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "SCHOOL_ADMIN",
    userId: "u1",
    tenantId: DEFAULT_TENANT_ID,
    channel: "web",
    ...overrides,
  };
}

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  await fs.rm(TASKS_FILE, { force: true });
  await fs.rm(NOTIFICATIONS_FILE, { force: true });
  await fs.rm(TASK_REMINDER_LOG_FILE, { force: true });
  await fs.rm(TASK_REMINDER_PREFERENCES_FILE, { force: true });
});

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function createTaskWithDueDate(dueDate: string, assigneeId = "t2") {
  const res = await createTaskTool(ctx(), {
    title: "Hatırlatma testi görevi",
    category: "Kayıt",
    assigneeId,
    dueDate,
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data.taskId;
}

/**
 * Faz 3A — hatırlatma tick motoru uçtan uca testleri. `t2` bootstrap
 * öğretmeni "user_teacher_t2" User hesabına bağlıdır (bkz.
 * src/lib/auth/users.ts) — bildirimler o targetUserId'ye gitmeli.
 */
describe("İş Takip hatırlatma tick motoru", () => {
  it("son tarihi geçmiş açık bir görev için OVERDUE bildirimi üretir", async () => {
    await createTaskWithDueDate(isoDaysFromNow(-2));
    const summary = await runTaskReminderTick();
    expect(summary.remindersCreated).toBeGreaterThanOrEqual(1);

    const notifications = await listAllNotifications(DEFAULT_TENANT_ID);
    const overdue = notifications.find((n) => n.kind === "task_overdue");
    expect(overdue).toBeDefined();
    expect(overdue?.targetUserId).toBe("user_teacher_t2");
  });

  it("aynı tick iki kez çağrılırsa aynı OVERDUE olayı ikinci kez ÜRETİLMEZ (tekilleştirme)", async () => {
    await createTaskWithDueDate(isoDaysFromNow(-1));
    const first = await runTaskReminderTick();
    const second = await runTaskReminderTick();
    expect(first.remindersCreated).toBe(1);
    expect(second.remindersCreated).toBe(0);
    expect(second.duplicatesSkipped).toBeGreaterThanOrEqual(1);

    const notifications = await listAllNotifications(DEFAULT_TENANT_ID);
    expect(notifications.filter((n) => n.kind === "task_overdue")).toHaveLength(1);
  });

  it("tamamlanmış/iptal edilmiş görev için hiç hatırlatma üretilmez", async () => {
    const taskId = await createTaskWithDueDate(isoDaysFromNow(-2));
    await updateTaskTool(ctx(), { taskId, status: "COMPLETED" });
    const summary = await runTaskReminderTick();
    expect(summary.remindersCreated).toBe(0);
  });

  it("dueDate'i olmayan bir görev için hiç hatırlatma üretilmez", async () => {
    const res = await createTaskTool(ctx(), { title: "Tarihsiz", category: "Kayıt", assigneeId: "t2" });
    if (!res.ok) throw new Error(res.error.message);
    const summary = await runTaskReminderTick();
    expect(summary.remindersCreated).toBe(0);
  });

  it("sorumlusu olmayan bir görev için hiç hatırlatma üretilmez", async () => {
    const res = await createTaskTool(ctx(), { title: "Sorumlusuz", category: "Kayıt", dueDate: isoDaysFromNow(-1) });
    if (!res.ok) throw new Error(res.error.message);
    const summary = await runTaskReminderTick();
    expect(summary.remindersCreated).toBe(0);
  });

  it("arşivlenmiş (pasif) bir sorumluya yeni hatırlatma üretilmez", async () => {
    // Taze bir öğretmen — seed öğretmenlerinin (t1..t3) gelecekteki dersleri
    // arşivlemeyi CONFLICT ile reddedebilir; yeni oluşturulanın hiç dersi yok.
    const teacherRes = await createTeacherTool(ctx(), {
      name: "Arşivlenecek Hatırlatma Öğretmeni",
      email: "arsiv-hatirlatma@okul.com",
      phone: "5551110099",
      branchId: "erzene",
      instrument: "Piyano",
    });
    if (!teacherRes.ok) throw new Error(teacherRes.error.message);

    const created = await createTaskTool(ctx(), {
      title: "Arşiv sorumlu testi",
      category: "Kayıt",
      assigneeId: teacherRes.data.teacherId,
      dueDate: isoDaysFromNow(-1),
    });
    if (!created.ok) throw new Error(created.error.message);

    const archiveRes = await archiveTeacherTool(ctx(), { teacherId: teacherRes.data.teacherId, archived: true });
    expect(archiveRes.ok).toBe(true);

    const summary = await runTaskReminderTick();
    expect(summary.remindersCreated).toBe(0);
  });

  it("sorumlu değiştirilince yeni tick'te YENİ sorumluya bildirim gider, eskiye tekrar gitmez", async () => {
    const taskId = await createTaskWithDueDate(isoDaysFromNow(-1), "t2");
    const first = await runTaskReminderTick();
    expect(first.remindersCreated).toBe(1);

    // "user_admin" doğrudan bir User.id'dir (bootstrap) — sorumluyu bir
    // öğretmenden bir admine değiştiriyoruz, farklı bir hedef kullanıcı.
    await updateTaskTool(ctx(), { taskId, assigneeId: "user_admin" });
    const second = await runTaskReminderTick();
    expect(second.remindersCreated).toBe(1); // yeni sorumluya, aynı gün bile

    const notifications = await listAllNotifications(DEFAULT_TENANT_ID);
    const overdueNotifs = notifications.filter((n) => n.kind === "task_overdue");
    expect(overdueNotifs).toHaveLength(2);
    const targets = overdueNotifs.map((n) => n.targetUserId).sort();
    expect(targets).toEqual(["user_admin", "user_teacher_t2"].sort());
  });

  it("bir kullanıcı farklı görevler için ayrı ayrı bildirim alabilir", async () => {
    await createTaskWithDueDate(isoDaysFromNow(-1), "t2");
    await createTaskWithDueDate(isoDaysFromNow(-3), "t2");
    const summary = await runTaskReminderTick();
    expect(summary.remindersCreated).toBe(2);
    const notifications = await listAllNotifications(DEFAULT_TENANT_ID);
    expect(notifications.filter((n) => n.kind === "task_overdue" && n.targetUserId === "user_teacher_t2")).toHaveLength(2);
  });

  it("kapalı bir hatırlatma türü tercihi varsa o tür üretilmez", async () => {
    await setReminderPreference(DEFAULT_TENANT_ID, "user_teacher_t2", {
      dueSoonEnabled: true,
      dueTodayEnabled: true,
      overdueEnabled: false,
    });
    await createTaskWithDueDate(isoDaysFromNow(-1), "t2");
    const summary = await runTaskReminderTick();
    expect(summary.remindersCreated).toBe(0);
    expect(summary.skipped).toBeGreaterThanOrEqual(1);
  });

  it("özet sayaçları tutarlıdır (tasksEvaluated >= remindersCreated + skipped + duplicatesSkipped alt kümesi)", async () => {
    await createTaskWithDueDate(isoDaysFromNow(-1));
    await createTaskWithDueDate(isoDaysFromNow(10)); // çok uzak — skip
    const summary = await runTaskReminderTick();
    expect(summary.tasksEvaluated).toBeGreaterThanOrEqual(2);
    expect(summary.tenantsProcessed).toBeGreaterThanOrEqual(1);
    expect(summary.errors).toBe(0);
  });
});
