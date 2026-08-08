-- İş Takip Faz 3A — son tarih hatırlatma motoru (DUE_SOON/DUE_TODAY/OVERDUE)
-- + kullanıcı tercihleri. İki YENİ tablo; hiçbir mevcut tablo/kolon
-- değişmiyor (additive). Notification tablosuna DOKUNULMADI (paylaşılan,
-- tahsilat/başka modüller de kullanıyor — kapsam dışı, risk almadan
-- mevcut createNotification() OKUNUR/ÇAĞRILIR, şeması değiştirilmez).

CREATE TABLE `TaskReminderLog` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `assigneeUserId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `calendarDay` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `TaskReminderLog_tenantId_taskId_assigneeUserId_kind_calend_key`
  ON `TaskReminderLog`(`tenantId`, `taskId`, `assigneeUserId`, `kind`, `calendarDay`);
CREATE INDEX `TaskReminderLog_tenantId_taskId_idx` ON `TaskReminderLog`(`tenantId`, `taskId`);

ALTER TABLE `TaskReminderLog`
  ADD CONSTRAINT `TaskReminderLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `TaskReminderPreference` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `dueSoonEnabled` BOOLEAN NOT NULL DEFAULT true,
  `dueTodayEnabled` BOOLEAN NOT NULL DEFAULT true,
  `overdueEnabled` BOOLEAN NOT NULL DEFAULT true,
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `TaskReminderPreference_tenantId_userId_key` ON `TaskReminderPreference`(`tenantId`, `userId`);

ALTER TABLE `TaskReminderPreference`
  ADD CONSTRAINT `TaskReminderPreference_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
