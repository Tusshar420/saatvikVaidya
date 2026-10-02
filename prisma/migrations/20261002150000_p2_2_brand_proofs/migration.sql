-- AlterTable
ALTER TABLE `BrandOrderDetails` ADD COLUMN `stage` ENUM('awaiting_proof', 'proof_sent', 'changes_requested', 'proof_approved', 'in_production', 'quality_check', 'dispatched', 'delivered', 'cancelled') NOT NULL DEFAULT 'awaiting_proof';

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `refundReference` VARCHAR(64) NULL,
    ADD COLUMN `refundedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `BrandProof` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(32) NOT NULL,
    `version` INTEGER NOT NULL,
    `fileKey` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `note` VARCHAR(500) NULL,
    `status` ENUM('pending', 'approved', 'changes_requested', 'superseded') NOT NULL DEFAULT 'pending',
    `comment` VARCHAR(1000) NULL,
    `uploadedById` VARCHAR(64) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BrandProof_fileKey_key`(`fileKey`),
    UNIQUE INDEX `BrandProof_orderId_version_key`(`orderId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrandStageEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(32) NOT NULL,
    `fromStage` ENUM('awaiting_proof', 'proof_sent', 'changes_requested', 'proof_approved', 'in_production', 'quality_check', 'dispatched', 'delivered', 'cancelled') NULL,
    `toStage` ENUM('awaiting_proof', 'proof_sent', 'changes_requested', 'proof_approved', 'in_production', 'quality_check', 'dispatched', 'delivered', 'cancelled') NOT NULL,
    `actorKind` VARCHAR(10) NOT NULL,
    `actorId` VARCHAR(64) NULL,
    `note` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BrandStageEvent_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BrandProof` ADD CONSTRAINT `BrandProof_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BrandOrderDetails`(`orderId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandStageEvent` ADD CONSTRAINT `BrandStageEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BrandOrderDetails`(`orderId`) ON DELETE CASCADE ON UPDATE CASCADE;
