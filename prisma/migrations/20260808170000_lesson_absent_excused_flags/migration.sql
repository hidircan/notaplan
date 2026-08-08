-- Yoklama kapanışı — Gelmedi (mazeretsiz) / Mazeretli bayrakları. Additive;
-- hiçbir mevcut kolon değişmiyor/silinmiyor, veri kaybı yok. Mevcut
-- Geldi/İşlendi/Telafi bayraklarıyla AYNI birbirini dışlayan tek-statü
-- mekanizmasının parçası, hiçbiri mali sonuç doğurmaz.

ALTER TABLE `Lesson`
  ADD COLUMN `studentAbsent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `studentAbsentAt` DATETIME(3) NULL,
  ADD COLUMN `studentAbsentBy` VARCHAR(191) NULL,
  ADD COLUMN `studentExcused` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `studentExcusedAt` DATETIME(3) NULL,
  ADD COLUMN `studentExcusedBy` VARCHAR(191) NULL;
