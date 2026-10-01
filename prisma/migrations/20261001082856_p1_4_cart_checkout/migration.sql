-- CreateTable
CREATE TABLE `Cart` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NULL,
    `guestTokenHash` CHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Cart_userId_key`(`userId`),
    UNIQUE INDEX `Cart_guestTokenHash_key`(`guestTokenHash`),
    INDEX `Cart_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cartId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CartItem_productId_idx`(`productId`),
    UNIQUE INDEX `CartItem_cartId_productId_key`(`cartId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Address` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `line1` VARCHAR(200) NOT NULL,
    `line2` VARCHAR(200) NULL,
    `landmark` VARCHAR(120) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(4) NOT NULL,
    `pincode` CHAR(6) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Address_userId_lastUsedAt_idx`(`userId`, `lastUsedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(32) NOT NULL,
    `number` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(64) NULL,
    `checkoutKey` VARCHAR(36) NOT NULL,
    `status` ENUM('pending_payment', 'paid', 'payment_failed', 'cancelled', 'processing', 'shipped', 'delivered') NOT NULL DEFAULT 'pending_payment',
    `shipName` VARCHAR(100) NOT NULL,
    `shipPhone` VARCHAR(20) NOT NULL,
    `shipLine1` VARCHAR(200) NOT NULL,
    `shipLine2` VARCHAR(200) NULL,
    `shipLandmark` VARCHAR(120) NULL,
    `shipCity` VARCHAR(100) NOT NULL,
    `shipState` VARCHAR(4) NOT NULL,
    `shipPincode` CHAR(6) NOT NULL,
    `subtotalPaise` INTEGER NOT NULL,
    `taxPaise` INTEGER NOT NULL,
    `shippingPaise` INTEGER NOT NULL,
    `totalPaise` INTEGER NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_number_key`(`number`),
    INDEX `Order_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Order_status_createdAt_idx`(`status`, `createdAt`),
    UNIQUE INDEX `Order_userId_checkoutKey_key`(`userId`, `checkoutKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(32) NOT NULL,
    `productId` INTEGER NULL,
    `productSlug` VARCHAR(120) NOT NULL,
    `productName` VARCHAR(160) NOT NULL,
    `packSize` VARCHAR(60) NOT NULL,
    `hsnCode` VARCHAR(8) NOT NULL,
    `gstRate` INTEGER NOT NULL,
    `mrpPaise` INTEGER NOT NULL,
    `unitPaise` INTEGER NOT NULL,
    `priceTier` VARCHAR(16) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `lineTotalPaise` INTEGER NOT NULL,
    `taxPaise` INTEGER NOT NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    INDEX `OrderItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(32) NOT NULL,
    `provider` VARCHAR(20) NOT NULL,
    `reference` VARCHAR(64) NOT NULL,
    `amountPaise` INTEGER NOT NULL,
    `status` ENUM('created', 'succeeded', 'failed') NOT NULL DEFAULT 'created',
    `attempt` INTEGER NOT NULL,
    `failureReason` VARCHAR(40) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_reference_key`(`reference`),
    UNIQUE INDEX `Payment_orderId_attempt_key`(`orderId`, `attempt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Address` ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
