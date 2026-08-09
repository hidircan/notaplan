-- Paket 5 — "Ödendi işaretle" modalında girilen isteğe bağlı referans/açıklama
-- notu. Additive; mevcut kolon değişmiyor/silinmiyor, veri kaybı yok.

ALTER TABLE `Payment`
  ADD COLUMN `paymentNote` VARCHAR(191) NULL;
