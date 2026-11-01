-- CreateTable
CREATE TABLE `AssistedOrder` (
    `id` VARCHAR(32) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `createdById` VARCHAR(64) NULL,
    `status` ENUM('open', 'placed', 'cancelled') NOT NULL DEFAULT 'open',
    `note` VARCHAR(500) NULL,
    `orderId` VARCHAR(32) NULL,
    `placedBy` VARCHAR(16) NULL,
    `placedAt` DATETIME(3) NULL,
    `codeHash` CHAR(64) NULL,
    `codeExpiresAt` DATETIME(3) NULL,
    `codeAttempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AssistedOrder_orderId_key`(`orderId`),
    INDEX `AssistedOrder_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `AssistedOrder_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `AssistedOrder_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssistedOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assistedOrderId` VARCHAR(32) NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `AssistedOrderItem_productId_idx`(`productId`),
    UNIQUE INDEX `AssistedOrderItem_assistedOrderId_productId_key`(`assistedOrderId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AssistedOrder` ADD CONSTRAINT `AssistedOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssistedOrder` ADD CONSTRAINT `AssistedOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssistedOrder` ADD CONSTRAINT `AssistedOrder_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssistedOrderItem` ADD CONSTRAINT `AssistedOrderItem_assistedOrderId_fkey` FOREIGN KEY (`assistedOrderId`) REFERENCES `AssistedOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssistedOrderItem` ADD CONSTRAINT `AssistedOrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
