/**
 * EPIC 10 (IMPLEMENTATION_PLAN.md) — geçmiş, onaylanmış ama `slaDeadline`si
 * olmayan telafi taleplerine tek seferlik SLA ataması yapar.
 *
 * Tahmin yöntemi (KASITLI OLARAK BASİT — bkz. Açık kararlar): onay anının
 * kesin kaydı bu talepler için tutulmadığından (bu epic'ten önce oluşturuldular),
 * `decidedAt` tahmini olarak talebin KENDİ `createdAt`'i kullanılır ve
 * `slaDeadline = decidedAt + 30 gün` olarak hesaplanır. Bu, geçmiş açık
 * taleplerin GERÇEKTEN ne zaman onaylandığını bilmediğimiz için en iyi
 * mevcut yaklaşımdır — çıktısı uygulama öncesi ürün sahibiyle gözden
 * geçirilmelidir (yanlış "SLA aşıldı" damgası basma riski, bkz. plan
 * "Riskler" bölümü).
 *
 * Kullanım (önce her zaman dry-run ile rapor alın):
 *   STORE_MODE=db npx tsx scripts/backfill-makeup-sla.ts
 *   STORE_MODE=db npx tsx scripts/backfill-makeup-sla.ts --apply
 *
 * İdempotent: sorgu yalnızca `slaDeadline IS NULL` kayıtları hedefler —
 * ikinci `--apply` çalıştırması hiçbir satırı bulamaz, no-op olur.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { computeSlaDeadline, resolveSlaEscalationLevel } from "../src/lib/makeup-engine";

async function main() {
  if (process.env.STORE_MODE !== "db") {
    throw new Error(
      "Bu betik yalnızca STORE_MODE=db ile çalışır. Örnek: STORE_MODE=db npx tsx scripts/backfill-makeup-sla.ts"
    );
  }

  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY (kalıcı yazım)" : "DRY-RUN (yalnızca rapor)";
  console.log(`== Telafi SLA backfill — ${mode} ==\n`);

  const targets = await prisma.makeupRequest.findMany({
    where: { status: "confirmed", slaDeadline: null },
    select: { id: true, tenantId: true, studentId: true, createdAt: true },
  });

  if (targets.length === 0) {
    console.log("SLA ataması gereken kayıt yok — her şey güncel.");
    return;
  }

  const now = new Date().toISOString();
  console.log(`${targets.length} onaylı talep, slaDeadline eksik. Tahmin: decidedAt ≈ createdAt.\n`);

  for (const req of targets) {
    const decidedAtEstimate = req.createdAt.toISOString();
    const slaDeadline = computeSlaDeadline(decidedAtEstimate);
    const slaEscalationLevel = resolveSlaEscalationLevel(slaDeadline, now);

    console.log(
      `  [${req.tenantId}] ${req.id} (öğrenci ${req.studentId}): ` +
        `oluşturulma=${decidedAtEstimate.slice(0, 10)} → slaDeadline=${slaDeadline.slice(0, 10)} ` +
        `(seviye ${slaEscalationLevel}${slaEscalationLevel === 5 ? " — AŞILDI" : ""})`
    );

    if (apply) {
      await prisma.makeupRequest.update({
        where: { id: req.id },
        data: {
          decidedAt: new Date(decidedAtEstimate),
          slaDeadline: new Date(slaDeadline),
          slaEscalationLevel,
        },
      });
    }
  }

  console.log(
    apply
      ? `\n✅ ${targets.length} kayıt güncellendi.`
      : `\nBu bir DRY-RUN'dı — hiçbir kayıt değiştirilmedi. Onaylıyorsanız --apply ile tekrar çalıştırın.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Backfill başarısız:", err);
    process.exit(1);
  });
