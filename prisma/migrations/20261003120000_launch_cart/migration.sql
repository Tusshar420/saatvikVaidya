-- Launch cart: a bulk order on /launch can hold several products, each with
-- its own quantity, in BrandCartItem (separate from the store cart). The
-- draft keeps only the packaging. A draft's chosen product and quantity move
-- into the cart (a missing quantity becomes the product's minimum).
-- Products can also have bulk branded price tiers (BrandPriceTier).

-- CreateTable
CREATE TABLE `BrandCartItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BrandCartItem_productId_idx`(`productId`),
    UNIQUE INDEX `BrandCartItem_userId_productId_key`(`userId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrandPriceTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `minQuantity` INTEGER NOT NULL,
    `pricePaise` INTEGER NOT NULL,

    UNIQUE INDEX `BrandPriceTier_productId_minQuantity_key`(`productId`, `minQuantity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BrandCartItem` ADD CONSTRAINT `BrandCartItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandCartItem` ADD CONSTRAINT `BrandCartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandPriceTier` ADD CONSTRAINT `BrandPriceTier_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Move each draft's product and quantity into the cart.
INSERT INTO `BrandCartItem` (`userId`, `productId`, `quantity`, `createdAt`, `updatedAt`)
  SELECT d.`userId`, d.`productId`, COALESCE(d.`quantity`, p.`brandMinQty`), d.`createdAt`, CURRENT_TIMESTAMP(3)
  FROM `BrandDraft` d
  JOIN `Product` p ON p.`id` = d.`productId`
  WHERE d.`productId` IS NOT NULL AND COALESCE(d.`quantity`, p.`brandMinQty`) IS NOT NULL;

-- DropForeignKey
ALTER TABLE `BrandDraft` DROP FOREIGN KEY `BrandDraft_productId_fkey`;

-- DropIndex
DROP INDEX `BrandDraft_productId_idx` ON `BrandDraft`;

-- AlterTable
ALTER TABLE `BrandDraft` DROP COLUMN `productId`,
    DROP COLUMN `quantity`;
