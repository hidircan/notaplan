-- Sprint-08: AI capability invocation audit trail (src/lib/ai/audit-hook.ts).
-- Adds ONE new table. No other table/column is touched.
--
-- `tenantId` is stored WITHOUT a foreign key to `Tenant` intentionally — an
-- audit trail must remain queryable even if the tenant row is later removed.
-- Every write is tenant-scoped by the application (fail-closed; no
-- DEFAULT_TENANT_ID fallback), enforced in code, not via DB constraint.

CREATE TABLE `AiAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `capabilityId` VARCHAR(191) NOT NULL,
    `callerRole` VARCHAR(191) NOT NULL,
    `chosenProvider` VARCHAR(191) NOT NULL,
    `usedFallback` BOOLEAN NOT NULL DEFAULT false,
    `success` BOOLEAN NOT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `durationMs` INTEGER NOT NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'not_required',
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AiAuditLog_tenantId_capabilityId_idx` ON `AiAuditLog`(`tenantId`, `capabilityId`);

CREATE INDEX `AiAuditLog_tenantId_approvalStatus_idx` ON `AiAuditLog`(`tenantId`, `approvalStatus`);
