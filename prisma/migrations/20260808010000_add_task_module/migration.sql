-- İş Takip modülü (insan-odaklı operasyon görev takibi — /panel/is-takip,
-- /ogretmen/is-takip). /panel/workflows (AI otomasyonu) ile İLGİSİZ, ayrı
-- bir modül. Dört YENİ tablo ekler; hiçbir mevcut tablo/kolon değişmiyor
-- (additive, veri kaybı yok).
--
-- Bağlı kayıtlar (studentId/teacherId/branchId/lessonId/paymentId/
-- documentId) kasıtlı olarak FOREIGN KEY DEĞİL — yalnızca ID olarak
-- tutulur. Aynı-tenant doğrulaması uygulama katmanında (src/lib/tasks.ts)
-- yapılır; bu, bağlı bir kaydın (ör. bir Payment) hard-delete edilmesinin
-- Task'ı silmeye zorlamasını (ON DELETE CASCADE zinciri) engeller — görevler
-- ASLA silinmez (yalnızca tamamlanır/iptal/arşivlenir/yeniden açılır).

CREATE TABLE `Task` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'TODO',
  `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
  `category` VARCHAR(191) NOT NULL,
  `assigneeId` VARCHAR(191) NULL,
  `followerIds` JSON NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `startDate` DATETIME(3) NULL,
  `dueDate` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `archivedAt` DATETIME(3) NULL,
  `progressPercent` INTEGER NOT NULL DEFAULT 0,
  `tags` JSON NOT NULL,
  `studentId` VARCHAR(191) NULL,
  `teacherId` VARCHAR(191) NULL,
  `branchId` VARCHAR(191) NULL,
  `lessonId` VARCHAR(191) NULL,
  `paymentId` VARCHAR(191) NULL,
  `documentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
);

CREATE INDEX `Task_tenantId_status_idx` ON `Task`(`tenantId`, `status`);
CREATE INDEX `Task_tenantId_assigneeId_idx` ON `Task`(`tenantId`, `assigneeId`);
CREATE INDEX `Task_tenantId_dueDate_idx` ON `Task`(`tenantId`, `dueDate`);
CREATE INDEX `Task_tenantId_studentId_idx` ON `Task`(`tenantId`, `studentId`);
CREATE INDEX `Task_tenantId_teacherId_idx` ON `Task`(`tenantId`, `teacherId`);

ALTER TABLE `Task`
  ADD CONSTRAINT `Task_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `TaskChecklistItem` (
  `id` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `isCompleted` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `completedAt` DATETIME(3) NULL,
  `completedById` VARCHAR(191) NULL,
  `archivedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
);

CREATE INDEX `TaskChecklistItem_taskId_idx` ON `TaskChecklistItem`(`taskId`);
CREATE INDEX `TaskChecklistItem_tenantId_idx` ON `TaskChecklistItem`(`tenantId`);

ALTER TABLE `TaskChecklistItem`
  ADD CONSTRAINT `TaskChecklistItem_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `TaskComment` (
  `id` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
);

CREATE INDEX `TaskComment_taskId_idx` ON `TaskComment`(`taskId`);
CREATE INDEX `TaskComment_tenantId_idx` ON `TaskComment`(`tenantId`);

ALTER TABLE `TaskComment`
  ADD CONSTRAINT `TaskComment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `TaskActivity` (
  `id` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `summary` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
);

CREATE INDEX `TaskActivity_taskId_idx` ON `TaskActivity`(`taskId`);
CREATE INDEX `TaskActivity_tenantId_idx` ON `TaskActivity`(`tenantId`);

ALTER TABLE `TaskActivity`
  ADD CONSTRAINT `TaskActivity_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
