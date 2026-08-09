-- Paket 6 — dönem bazlı (Güz/Yaz) haftalık kapalı gün özelleştirmesi.
-- Additive; null ise mevcut sabit varsayılan davranış (Güz: Pazartesi,
-- Yaz: Cts/Paz) korunur, hiçbir okul için davranış değişmez.

ALTER TABLE `School`
  ADD COLUMN `termWeeklyClosedDays` JSON NULL;
