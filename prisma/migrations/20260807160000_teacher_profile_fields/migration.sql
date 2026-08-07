-- ÖNCELİK 4 (devam) — Öğretmen CSV çoklu enstrüman revizyonu. Bu 5 alan
-- (lise/üniversite/mezuniyet yılı/sözleşme başlangıç-bitiş) TS tipinde
-- (Teacher, src/lib/types.ts) zaten tanımlıydı ama Prisma şemasında hiç
-- karşılığı yoktu — db modunda sessizce kaybolan alanlardı. Hepsi nullable:
-- mevcut hiçbir öğretmen kaydı etkilenmez.

ALTER TABLE `Teacher`
  ADD COLUMN `highSchool` VARCHAR(191) NULL,
  ADD COLUMN `university` VARCHAR(191) NULL,
  ADD COLUMN `graduationYear` INTEGER NULL,
  ADD COLUMN `contractStartDate` DATETIME(3) NULL,
  ADD COLUMN `contractEndDate` DATETIME(3) NULL;
