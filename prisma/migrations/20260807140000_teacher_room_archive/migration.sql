-- ÖNCELİK 4 (devam) — Öğretmen arşivleme (hard delete yok) + Oda pasife
-- alma. Her ikisi de nullable/varsayılanlı eklenir: mevcut kayıtlar
-- (Teacher.active zaten vardı; Room.active YENİ, varsayılan true) hiçbir
-- davranış değişikliği görmeden çalışmaya devam eder.

ALTER TABLE `Teacher`
  ADD COLUMN `archivedAt` DATETIME(3) NULL;

ALTER TABLE `Room`
  ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `archivedAt` DATETIME(3) NULL;
