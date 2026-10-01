-- AlterTable
ALTER TABLE `Order` ADD COLUMN `coinDiscountPaise` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `coinsRedeemed` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `discountPaise` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `CoinLedger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NOT NULL,
    `amount` INTEGER NOT NULL,
    `reason` ENUM('earn_order', 'earn_reversal', 'earn_profile', 'redeem', 'redeem_return', 'admin_adjust') NOT NULL,
    `reference` VARCHAR(64) NULL,
    `note` VARCHAR(300) NULL,
    `expiresAt` DATETIME(3) NULL,
    `actorId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CoinLedger_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `CoinLedger_userId_reason_reference_key`(`userId`, `reason`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoinLedger` ADD CONSTRAINT `CoinLedger_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
