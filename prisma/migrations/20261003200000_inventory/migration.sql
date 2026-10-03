-- AlterTable
ALTER TABLE `Brand` ADD COLUMN `isPartner` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `StockItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('finished', 'packaging', 'base') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `sku` VARCHAR(60) NULL,
    `unit` ENUM('pcs', 'ml', 'g') NOT NULL DEFAULT 'pcs',
    `componentType` VARCHAR(30) NULL,
    `productId` INTEGER NULL,
    `onHand` INTEGER NOT NULL DEFAULT 0,
    `reserved` INTEGER NOT NULL DEFAULT 0,
    `lowThreshold` INTEGER NOT NULL DEFAULT 0,
    `madeToOrder` BOOLEAN NOT NULL DEFAULT false,
    `purchaseCostPaise` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockItem_sku_key`(`sku`),
    UNIQUE INDEX `StockItem_productId_key`(`productId`),
    INDEX `StockItem_kind_active_idx`(`kind`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `batchNo` VARCHAR(60) NOT NULL,
    `mfgDate` DATE NULL,
    `expiryDate` DATE NULL,
    `qtyOnHand` INTEGER NOT NULL DEFAULT 0,
    `qtyReserved` INTEGER NOT NULL DEFAULT 0,
    `unitCostPaise` INTEGER NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockBatch_itemId_expiryDate_idx`(`itemId`, `expiryDate`),
    UNIQUE INDEX `StockBatch_itemId_batchNo_key`(`itemId`, `batchNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `batchId` INTEGER NULL,
    `type` ENUM('receipt', 'sale', 'reservation', 'release', 'consumption', 'return', 'adjustment', 'expiry_write_off') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `onHandDelta` INTEGER NOT NULL,
    `reservedDelta` INTEGER NOT NULL,
    `onHandAfter` INTEGER NOT NULL,
    `reason` VARCHAR(300) NULL,
    `refType` VARCHAR(30) NULL,
    `refId` VARCHAR(40) NULL,
    `userId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockMovement_itemId_createdAt_idx`(`itemId`, `createdAt`),
    INDEX `StockMovement_refType_refId_idx`(`refType`, `refId`),
    INDEX `StockMovement_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockReservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `batchId` INTEGER NULL,
    `quantity` INTEGER NOT NULL,
    `refType` VARCHAR(30) NOT NULL,
    `refId` VARCHAR(40) NOT NULL,
    `status` ENUM('active', 'consumed', 'released') NOT NULL DEFAULT 'active',
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockReservation_refType_refId_status_idx`(`refType`, `refId`, `status`),
    INDEX `StockReservation_status_expiresAt_idx`(`status`, `expiresAt`),
    INDEX `StockReservation_itemId_status_idx`(`itemId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecipeLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `componentId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `RecipeLine_componentId_idx`(`componentId`),
    UNIQUE INDEX `RecipeLine_productId_componentId_key`(`productId`, `componentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `StockBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `StockBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecipeLine` ADD CONSTRAINT `RecipeLine_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecipeLine` ADD CONSTRAINT `RecipeLine_componentId_fkey` FOREIGN KEY (`componentId`) REFERENCES `StockItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing data: every product becomes a finished-goods stock item, and its
-- old stock figure becomes one opening batch (no expiry date known).
INSERT INTO `StockItem` (`kind`, `name`, `unit`, `productId`, `onHand`, `reserved`, `lowThreshold`, `createdAt`, `updatedAt`)
SELECT 'finished', `name`, 'pcs', `id`, GREATEST(`stock`, 0), 0, CASE WHEN `stock` > 0 THEN 10 ELSE 0 END, NOW(3), NOW(3)
FROM `Product`;

INSERT INTO `StockBatch` (`itemId`, `batchNo`, `qtyOnHand`, `qtyReserved`, `receivedAt`)
SELECT i.`id`, 'OPENING', p.`stock`, 0, NOW(3)
FROM `StockItem` i JOIN `Product` p ON p.`id` = i.`productId`
WHERE p.`stock` > 0;

INSERT INTO `StockMovement` (`itemId`, `batchId`, `type`, `quantity`, `onHandDelta`, `reservedDelta`, `onHandAfter`, `reason`, `createdAt`)
SELECT b.`itemId`, b.`id`, 'receipt', b.`qtyOnHand`, b.`qtyOnHand`, 0, b.`qtyOnHand`, 'Opening stock moved from the old stock figure', NOW(3)
FROM `StockBatch` b WHERE b.`batchNo` = 'OPENING';

-- The old figure is now held by the batches.
ALTER TABLE `Product` DROP COLUMN `stock`;
