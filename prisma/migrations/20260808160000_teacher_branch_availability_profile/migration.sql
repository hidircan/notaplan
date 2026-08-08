-- Package D — öğretmen şube bazlı müsaitlik + özlük/idari alanları.
-- Additive; hiçbir mevcut kolon değişmiyor/silinmiyor, veri kaybı yok.
-- `availability` (mevcut Json kolon) artık her pencerede opsiyonel bir
-- `branchId` taşıyabilir — bu, kolon şemasını DEĞİŞTİRMEZ (JSON içeriği
-- uygulama katmanında yorumlanır).

ALTER TABLE `Teacher`
  ADD COLUMN `nationalIdCipher` TEXT NULL,
  ADD COLUMN `nationalIdLast2` VARCHAR(191) NULL,
  ADD COLUMN `birthDate` DATETIME(3) NULL,
  ADD COLUMN `address` VARCHAR(191) NULL,
  ADD COLUMN `branchIds` JSON NULL,
  ADD COLUMN `employmentType` VARCHAR(191) NULL,
  ADD COLUMN `hireDate` DATETIME(3) NULL,
  ADD COLUMN `terminationDate` DATETIME(3) NULL,
  ADD COLUMN `emergencyContactName` VARCHAR(191) NULL,
  ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL,
  ADD COLUMN `personnelNotes` TEXT NULL;
