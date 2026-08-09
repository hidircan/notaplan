-- Paket 7 — öğrenci kaydında TC kimlik alanından hemen sonra istenen anne
-- adı / baba adı. Additive, opsiyonel; mevcut kolon/veri değişmiyor.

ALTER TABLE `Student`
  ADD COLUMN `motherName` VARCHAR(191) NULL,
  ADD COLUMN `fatherName` VARCHAR(191) NULL;
