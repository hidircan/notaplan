-- İş Takip Faz 3B-2A — göreve güvenli dosya/link eki. TEK yeni tablo,
-- additive; hiçbir mevcut kolon değişmiyor. `fileData` (base64) yalnızca
-- sahiplik/tenant kontrolü geçen indirme yolundan (getTaskAttachmentFileTool)
-- okunur — hiçbir zaman tahmin edilebilir/herkese açık bir URL'ye yazılmaz,
-- TeachingMaterial/HomeworkSubmission ile aynı desen. Task silinince
-- ekler ON DELETE CASCADE ile birlikte silinir.

CREATE TABLE `TaskAttachment` (
  `id` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `url` TEXT NULL,
  `fileName` VARCHAR(191) NULL,
  `fileMimeType` VARCHAR(191) NULL,
  `fileSize` INTEGER NULL,
  `fileData` LONGTEXT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
);

CREATE INDEX `TaskAttachment_taskId_idx` ON `TaskAttachment`(`taskId`);
CREATE INDEX `TaskAttachment_tenantId_idx` ON `TaskAttachment`(`tenantId`);

ALTER TABLE `TaskAttachment`
  ADD CONSTRAINT `TaskAttachment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
