ALTER TABLE `Lesson`
  ADD COLUMN `studentAttended` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `studentAttendedAt` DATETIME(3) NULL,
  ADD COLUMN `studentAttendedBy` VARCHAR(191) NULL,
  ADD COLUMN `lessonProcessed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lessonProcessedAt` DATETIME(3) NULL,
  ADD COLUMN `lessonProcessedBy` VARCHAR(191) NULL,
  ADD COLUMN `opsMakeupFlag` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `opsMakeupFlagAt` DATETIME(3) NULL,
  ADD COLUMN `opsMakeupFlagBy` VARCHAR(191) NULL;
