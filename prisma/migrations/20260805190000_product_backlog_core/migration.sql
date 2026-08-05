-- AlterTable Student
ALTER TABLE `Student` ADD COLUMN `birthDate` DATETIME(3) NULL,
    ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `nationalIdCipher` TEXT NULL,
    ADD COLUMN `nationalIdLast2` VARCHAR(191) NULL,
    ADD COLUMN `educationMethod` VARCHAR(191) NULL,
    ADD COLUMN `lessonDurationMinutes` INTEGER NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `paymentAmount` INTEGER NULL,
    ADD COLUMN `paymentDueDay` INTEGER NULL,
    ADD COLUMN `firstLessonAt` DATETIME(3) NULL,
    ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- AlterTable Teacher
ALTER TABLE `Teacher` ADD COLUMN `highSchool` VARCHAR(191) NULL,
    ADD COLUMN `university` VARCHAR(191) NULL,
    ADD COLUMN `graduationYear` INTEGER NULL,
    ADD COLUMN `birthDate` DATETIME(3) NULL,
    ADD COLUMN `nationalIdCipher` TEXT NULL,
    ADD COLUMN `nationalIdLast2` VARCHAR(191) NULL,
    ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `contractStartDate` DATETIME(3) NULL,
    ADD COLUMN `contractEndDate` DATETIME(3) NULL,
    ADD COLUMN `instrumentLevels` JSON NULL,
    ADD COLUMN `weeklyHoursThreshold` INTEGER NULL;

CREATE TABLE `SocialMediaConsent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `representativeName` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL,
    `scopes` JSON NOT NULL,
    `sourceDocumentRef` VARCHAR(191) NULL,
    `withdrawnAt` DATETIME(3) NULL,
    `history` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `SocialMediaConsent_tenantId_studentId_idx`(`tenantId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ClosedDay` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ClosedDay_tenantId_date_key`(`tenantId`, `date`),
    INDEX `ClosedDay_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TrialLesson` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `instrument` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'planned',
    `convertedStudentId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `TrialLesson_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `TrialLesson_tenantId_teacherId_idx`(`tenantId`, `teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `bodyHtml` LONGTEXT NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `DocumentTemplate_tenantId_kind_idx`(`tenantId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentInstance` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `studentId` VARCHAR(191) NULL,
    `teacherId` VARCHAR(191) NULL,
    `trialLessonId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `fieldValues` JSON NOT NULL,
    `renderedHtml` LONGTEXT NULL,
    `printCount` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `DocumentInstance_tenantId_reference_key`(`tenantId`, `reference`),
    INDEX `DocumentInstance_tenantId_studentId_idx`(`tenantId`, `studentId`),
    INDEX `DocumentInstance_tenantId_kind_idx`(`tenantId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SocialMediaConsent` ADD CONSTRAINT `SocialMediaConsent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ClosedDay` ADD CONSTRAINT `ClosedDay_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TrialLesson` ADD CONSTRAINT `TrialLesson_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTemplate` ADD CONSTRAINT `DocumentTemplate_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentInstance` ADD CONSTRAINT `DocumentInstance_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
