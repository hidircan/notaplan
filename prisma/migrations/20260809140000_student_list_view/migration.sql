-- Öğrenciler ekranı "Sütunlar / Görünüm yönetimi" — aynı tenant içindeki
-- yöneticilerin paylaştığı, isimle kaydedilmiş kolon düzenleri. Yeni tablo,
-- mevcut hiçbir kolon/veri değişmiyor.

CREATE TABLE `StudentListView` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `columns` JSON NOT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `StudentListView_tenantId_name_key`(`tenantId`, `name`),
  INDEX `StudentListView_tenantId_idx`(`tenantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StudentListView` ADD CONSTRAINT `StudentListView_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
