-- Package C — öğrenci paket/süre/indirim fiyatlandırma alanları. Additive;
-- hiçbir mevcut kolon değişmiyor/silinmiyor, veri kaybı yok. `monthlyFee`
-- (mevcut kolon) nihai ücret olarak tek gerçek kaynak kalır; bu migration
-- yalnızca taban fiyat/indirim/override BİLGİSİNİ ayrı, yeni kolonlarda saklar.

ALTER TABLE `Student`
  ADD COLUMN `packageBaseMonthlyFee` INTEGER NULL,
  ADD COLUMN `discountType` VARCHAR(191) NULL,
  ADD COLUMN `discountValue` DOUBLE NULL,
  ADD COLUMN `monthlyFeeManualOverride` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `monthlyFeeOverrideReason` TEXT NULL;
