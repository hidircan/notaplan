-- Evraklar — şablon versiyonlama + imzalı sürüm geçmişi. Additive; hiçbir
-- mevcut kolon değişmiyor/silinmiyor, veri kaybı yok. `DocumentInstance`
-- için `@@unique([tenantId, reference])` zaten mevcuttu (benzersizlik DB
-- seviyesinde önceden garantiliydi) — bu migration yalnızca YENİ kolonlar
-- ekliyor.

ALTER TABLE `DocumentTemplate`
  ADD COLUMN `createdById` VARCHAR(191) NULL,
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `DocumentInstance`
  ADD COLUMN `fileSize` INTEGER NULL,
  ADD COLUMN `signedBy` VARCHAR(191) NULL,
  ADD COLUMN `signedVersions` JSON NULL;
