-- İş Takip — bağlamsal görev oluşturma (İş Takip Merkezi paketi). Additive
-- ALTER TABLE only: mevcut studentId/teacherId/... FK alanlarına dokunmaz,
-- onların karşılamadığı ilişki tiplerini (telafi, ders düzeltme, şube-context
-- genel görünüm) kapsayan GENEL bir ilişkili-kayıt üçlüsü ekler.

ALTER TABLE `Task`
  ADD COLUMN `relatedEntityType` VARCHAR(191) NULL,
  ADD COLUMN `relatedEntityId` VARCHAR(191) NULL,
  ADD COLUMN `relatedEntityLabel` VARCHAR(191) NULL;

CREATE INDEX `Task_tenantId_relatedEntityType_relatedEntityId_idx`
  ON `Task`(`tenantId`, `relatedEntityType`, `relatedEntityId`);
