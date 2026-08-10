-- ÖNCELİK 4 (devam) — Paket Yönetimi + öğrenci ödeme profili. Additive:
-- tüm kolonlar nullable, mevcut hiçbir Package/Student kaydı etkilenmez.

ALTER TABLE `Package`
  ADD COLUMN `monthlyLessonCount` INTEGER NULL,
  ADD COLUMN `groupLessonCount` INTEGER NULL,
  ADD COLUMN `defaultDurationMinutes` INTEGER NULL,
  ADD COLUMN `defaultPaymentDueDay` INTEGER NULL,
  ADD COLUMN `notes` TEXT NULL;

ALTER TABLE `Student`
  ADD COLUMN `discountType` VARCHAR(191) NULL,
  ADD COLUMN `discountValue` INTEGER NULL;
