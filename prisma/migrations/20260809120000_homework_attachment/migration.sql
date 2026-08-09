-- Paket 7 — öğretmenin ödevi verirken ekleyebileceği isteğe bağlı dosya/
-- foto/video. Additive; mevcut kolon/veri değişmiyor.

ALTER TABLE `Homework`
  ADD COLUMN `fileName` VARCHAR(191) NULL,
  ADD COLUMN `fileMimeType` VARCHAR(191) NULL,
  ADD COLUMN `fileData` LONGTEXT NULL;
