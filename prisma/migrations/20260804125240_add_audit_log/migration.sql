-- EPIC 0 (IMPLEMENTATION_PLAN.md): general-purpose critical-action audit
-- trail. Adds ONE new table. No other table/column is touched.
--
-- Distinct from `AiAuditLog` (AI capability invocations only) — this covers
-- human-triggered critical writes: payments, tahsilat messages, teacher fee
-- changes, makeup decisions, student data writes.
--
-- `tenantId` is stored WITHOUT a foreign key to `Tenant`, same rationale as
-- `AiAuditLog`: the trail must remain queryable even if the tenant row is
-- later removed. Every write is tenant-scoped by the application.

CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `actorRole` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AuditLog_tenantId_action_createdAt_idx` ON `AuditLog`(`tenantId`, `action`, `createdAt`);

CREATE INDEX `AuditLog_tenantId_entityType_entityId_idx` ON `AuditLog`(`tenantId`, `entityType`, `entityId`);
