-- Tahsilatı ALAN kullanıcının kalıcı kimliği. Additive, nullable — mevcut
-- hiçbir satır/davranış değişmez. FK yok (AuditLog ile aynı gerekçe).

ALTER TABLE `Payment` ADD COLUMN `receivedByUserId` VARCHAR(191) NULL;
