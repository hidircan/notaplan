-- ÖNCELİK 4 (devam) — Öğretmen çoklu enstrüman+seviye, Paket Yönetimi,
-- öğrenci ek profil alanları (doğum yeri, okul/meslek). Tümü NULLABLE/
-- opsiyonel eklenir: mevcut kayıtlar veri kaybı olmadan legacy kalır.

ALTER TABLE `Teacher`
  ADD COLUMN `instrumentLevels` JSON NULL;

CREATE TABLE `Package` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `price30Min` INTEGER NOT NULL,
  `price40Min` INTEGER NOT NULL,
  `price50Min` INTEGER NOT NULL,
  `termLabel` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
);

CREATE INDEX `Package_tenantId_idx` ON `Package`(`tenantId`);
CREATE INDEX `Package_tenantId_status_idx` ON `Package`(`tenantId`, `status`);

ALTER TABLE `Package`
  ADD CONSTRAINT `Package_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Student`
  ADD COLUMN `packageId` VARCHAR(191) NULL,
  ADD COLUMN `birthPlace` VARCHAR(191) NULL,
  ADD COLUMN `schoolOrOccupation` VARCHAR(191) NULL;

ALTER TABLE `Student`
  ADD CONSTRAINT `Student_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
