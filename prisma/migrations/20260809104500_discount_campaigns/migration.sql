-- Paket 5 — yüzde tabanlı kampanya/indirim kural motoru (ör. "Kardeş
-- Kampanyası"). Yeni tablo, mevcut hiçbir kolon/veri değişmiyor.

CREATE TABLE `DiscountCampaign` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `discountPercent` INTEGER NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `validFrom` DATETIME(3) NULL,
  `validTo` DATETIME(3) NULL,
  `branchId` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `DiscountCampaign_tenantId_idx`(`tenantId`),
  INDEX `DiscountCampaign_tenantId_active_idx`(`tenantId`, `active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DiscountCampaign` ADD CONSTRAINT `DiscountCampaign_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
