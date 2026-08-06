ALTER TABLE `Payment`
  ADD COLUMN `lessonId` VARCHAR(191) NULL,
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'manual';

CREATE INDEX `Payment_tenantId_lessonId_idx` ON `Payment`(`tenantId`, `lessonId`);
