import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { jsonFail } from "@/lib/api/http";
import { runTaskReminderTick } from "@/lib/task-reminder-tick";
import { recordAuditLog } from "@/lib/audit/log";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/tasks/reminders/tick — İş Takip DUE_SOON/DUE_TODAY/OVERDUE
 * hatırlatma motorunu tetikler.
 *
 * NEDEN AYRI BİR UÇ NOKTA (workflows/tick'e hook değil): (1) auth modeli
 * temelden farklı — `/api/v1/workflows/tick` normal kullanıcı JWT'siyle,
 * TEK bir tenant için (JWT claim'inden) çalışır; bu uç nokta ise gerçek bir
 * kullanıcı OTURUMU OLMADAN, paylaşılan bir secret ile TÜM tenant'ları tek
 * batch'te dolaşır — ikisini aynı koda karıştırmak workflows'un tek-tenant
 * JWT modelini bozardı. (2) modül tanımı gereği İş Takip `/panel/workflows`
 * (AI otomasyonu) ile karıştırılmayacak, tamamen ayrı tutulacaktı — bu görev
 * boyunca zaten tutarlı şekilde uygulanan bir kural (bkz. task-notifications.ts).
 *
 * GÜVENLİK — fail-closed: `TASK_REMINDER_CRON_SECRET` env değişkeni
 * tanımlı DEĞİLSE (boş/undefined) istek ne olursa olsun 503 ile reddedilir
 * — "secret yok, o zaman kontrolsüz izin ver" ASLA yapılmaz. Tanımlıysa
 * `Authorization: Bearer <secret>` başlığı `timingSafeEqual` ile (basit
 * `===` DEĞİL — zamanlama saldırısına karşı) karşılaştırılır. Normal bir
 * kullanıcı JWT'si (Bearer <jwt>) burada GEÇERSİZDİR — bu uç nokta
 * `authenticateRequest`/`withApiHandler`'ı KULLANMAZ, bilinçli olarak ayrı
 * bir (secret-only) kimlik doğrulama yolu. Her çağrı (başarılı/başarısız)
 * `recordAuditLog`'a "tasks.reminders.tick" olarak yazılır.
 *
 * ÖNERİLEN SIKLIK: saatlik tick yeterlidir — `classifyTaskReminder`
 * (src/lib/task-reminders.ts) DUE_TODAY için "sabah 08:00'den sonra" eşiği
 * kullandığından ve tekilleştirme gün bazlı (calendarDay) olduğundan, saatte
 * bir çağrılması hem DUE_SOON/DUE_TODAY'i makul bir gecikmeyle yakalar hem
 * de OVERDUE'nun günde tek sefer üretilmesini doğal olarak garantiler —
 * daha sık çağrı (ör. her 5 dakika) yalnızca gereksiz tenant/görev taraması
 * yapar, sonucu DEĞİŞTİRMEZ (tekilleştirme zaten idempotent). Bu proje bir
 * gerçek scheduler'a BAĞLANMADI — yalnızca uç nokta + bu öneri belgelenir,
 * asıl zamanlama (Vercel Cron / harici cron) deploy aşamasında ayarlanır.
 */

function timingSafeStringEqual(a: string, b: string): boolean {
  // Uzunluk farklıysa timingSafeEqual fırlatır — önce sabit uzunlukta hash'e
  // indirger, böylece uzunluk bilgisi bile sızmaz.
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function POST(request: Request) {
  const requestId = uid("audit");
  const configuredSecret = process.env.TASK_REMINDER_CRON_SECRET;

  if (!configuredSecret) {
    // Fail-closed — env değişkeni ayarlanmadan bu uç nokta ASLA çalışmaz.
    void recordAuditLog({
      tenantId: "system",
      actorUserId: "cron",
      actorRole: "SYSTEM",
      action: "tasks.reminders.tick",
      entityType: "TaskReminderTick",
      entityId: requestId,
      outcome: "denied",
      meta: { reason: "secret_not_configured" },
    });
    return jsonFail("FORBIDDEN", "Hatırlatma tick'i yapılandırılmamış (TASK_REMINDER_CRON_SECRET eksik).");
  }

  const provided = extractBearer(request);
  if (!provided || !timingSafeStringEqual(provided, configuredSecret)) {
    void recordAuditLog({
      tenantId: "system",
      actorUserId: "cron",
      actorRole: "SYSTEM",
      action: "tasks.reminders.tick",
      entityType: "TaskReminderTick",
      entityId: requestId,
      outcome: "denied",
      meta: { reason: "invalid_secret" },
    });
    return jsonFail("UNAUTHORIZED", "Geçersiz veya eksik yetkilendirme.");
  }

  try {
    const summary = await runTaskReminderTick();
    void recordAuditLog({
      tenantId: "system",
      actorUserId: "cron",
      actorRole: "SYSTEM",
      action: "tasks.reminders.tick",
      entityType: "TaskReminderTick",
      entityId: requestId,
      outcome: "success",
      meta: {
        tenantsProcessed: summary.tenantsProcessed,
        tasksEvaluated: summary.tasksEvaluated,
        remindersCreated: summary.remindersCreated,
        duplicatesSkipped: summary.duplicatesSkipped,
        skipped: summary.skipped,
        errors: summary.errors,
      },
    });
    return NextResponse.json({ ok: true, data: summary }, { status: 200 });
  } catch (e) {
    void recordAuditLog({
      tenantId: "system",
      actorUserId: "cron",
      actorRole: "SYSTEM",
      action: "tasks.reminders.tick",
      entityType: "TaskReminderTick",
      entityId: requestId,
      outcome: "error",
      meta: { message: e instanceof Error ? e.message : String(e) },
    });
    return jsonFail("INTERNAL_ERROR", "Hatırlatma tick'i başarısız oldu.");
  }
}

/** Yalnızca POST — diğer method'lar reddedilir (yetkisiz erişim yüzeyini daraltır). */
export async function GET() {
  return jsonFail("VALIDATION_ERROR", "Yalnızca POST desteklenir.");
}
