-- ÖNCELİK 4 (devam) — Yönetilebilir Enstrüman Kataloğu. Yeni, tenant-scoped
-- tablo; mevcut hiçbir Teacher/Student/Room/Lesson kaydına dokunmaz.

CREATE TABLE `InstrumentCatalogEntry` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
);

CREATE INDEX `InstrumentCatalogEntry_tenantId_idx` ON `InstrumentCatalogEntry`(`tenantId`);
CREATE INDEX `InstrumentCatalogEntry_tenantId_status_idx` ON `InstrumentCatalogEntry`(`tenantId`, `status`);

ALTER TABLE `InstrumentCatalogEntry`
  ADD CONSTRAINT `InstrumentCatalogEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
