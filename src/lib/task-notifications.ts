/**
 * İş Takip → mevcut kurum-içi bildirim altyapısına (src/lib/notifications)
 * KÖPRÜ — yeni bir bildirim sistemi KURULMAZ, yalnızca `createNotification`
 * çağrılır. Faz 2 kapsamı bilinçli olarak SADECE "sorumlu atandı" olayına
 * sınırlıdır (event-driven, tek bir yazma anında tetiklenir, güvenli).
 *
 * "Son tarih yaklaşınca" / "gecikince" bildirimleri KASITLI OLARAK
 * YAPILMADI: bu uygulamada tekrarlayan/zamanlanmış bir tetikleyici yalnızca
 * `/panel/workflows` (AI otomasyon motoru, `src/lib/workflows/engine.ts`)
 * üzerinden var — İş Takip'i oraya bağlamak görev tanımının "workflows ile
 * KARIŞTIRMA, tamamen ayrı" kuralını ihlal eder. Yeni bir zamanlayıcı/cron
 * icat etmek de (bu ortamda gerçek bir scheduler olmadan) kırılgan,
 * doğrulanamaz bir şey inşa etmek olurdu. Bu yüzden bu iki bildirim türü
 * bilinçli olarak Faz 3'e bırakıldı (bkz. teslim raporu) — zorlama yok.
 */

import { isDbMode } from "./config";

/**
 * `assigneeId` bir Teacher.id (öğretmen personel) VEYA doğrudan bir
 * User.id (admin) olabilir (bkz. src/lib/types.ts Task.assigneeId yorumu).
 * Bildirim `Notification.targetUserId` bir User.id BEKLEDİĞİ için, bir
 * Teacher.id verilmişse önce ilgili User kaydı bulunur. Eşleşme yoksa
 * (ör. o öğretmenin login hesabı yok) sessizce `undefined` döner —
 * bildirim oluşturulmaz, hata da fırlatılmaz (best-effort, kritik yola
 * blokaj yapmaz — audit/task işlemi bundan etkilenmemeli).
 */
export async function resolveTaskNotifyUserId(
  tenantId: string,
  assigneeId: string | undefined
): Promise<string | undefined> {
  if (!assigneeId) return undefined;
  try {
    if (isDbMode) {
      const { prisma } = await import("./db");
      const byUserId = await prisma.user.findFirst({ where: { id: assigneeId, tenantId } });
      if (byUserId) return byUserId.id;
      const byTeacherId = await prisma.user.findFirst({ where: { teacherId: assigneeId, tenantId } });
      return byTeacherId?.id;
    }
    // json/memory demo modu — dinamik bir User tablosu yok, sabit bootstrap
    // kimlikleri var (bkz. src/lib/auth/users.ts). Yalnızca OKUNUR, hiçbir
    // alan değiştirilmez/eklenmez.
    const { getBootstrapUsersForSeed } = await import("./auth/users");
    const users = getBootstrapUsersForSeed(tenantId);
    if (users.some((u) => u.id === assigneeId)) return assigneeId;
    return users.find((u) => u.teacherId === assigneeId)?.id;
  } catch {
    return undefined;
  }
}

/** Sorumlu atandığında bildirim — best-effort, hata fırlatmaz (görev işlemini bloklamaz). */
export async function notifyTaskAssigned(
  tenantId: string,
  assigneeId: string | undefined,
  taskTitle: string
): Promise<void> {
  const targetUserId = await resolveTaskNotifyUserId(tenantId, assigneeId);
  if (!targetUserId) return;
  try {
    const { createNotification } = await import("./notifications");
    await createNotification({
      tenantId,
      targetUserId,
      kind: "task_assigned",
      title: "Yeni görev atandı",
      body: `"${taskTitle}" görevi size atandı.`,
    });
  } catch {
    // best-effort — bildirim oluşturulamasa bile görev ataması geçerli kalır.
  }
}
