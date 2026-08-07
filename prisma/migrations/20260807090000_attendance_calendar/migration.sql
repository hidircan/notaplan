-- ÖNCELİK 4 — Yoklama Takvimi: Lesson'a 4. operasyonel bayrak (Kapalı),
-- Student'a dönem tipi, ClosedDay'e (daha önce hiç kullanılmamış tablo)
-- açık/kapalı zorlama alanı.

ALTER TABLE `Lesson`
  ADD COLUMN `opsClosedFlag` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `opsClosedFlagAt` DATETIME(3) NULL,
  ADD COLUMN `opsClosedFlagBy` VARCHAR(191) NULL;

ALTER TABLE `Student`
  ADD COLUMN `termType` VARCHAR(191) NULL;

ALTER TABLE `ClosedDay`
  ADD COLUMN `isOpen` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
