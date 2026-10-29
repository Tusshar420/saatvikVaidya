-- AlterTable
ALTER TABLE `UserType` ADD COLUMN `bulkPricing` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `brandId` INTEGER NULL,
    `formId` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `ingredients` TEXT NULL,
    `dosage` TEXT NULL,
    `packSize` VARCHAR(60) NOT NULL,
    `mrpPaise` INTEGER NOT NULL,
    `professionalPricePaise` INTEGER NOT NULL,
    `gstRate` INTEGER NOT NULL,
    `hsnCode` VARCHAR(8) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `moq` INTEGER NOT NULL DEFAULT 1,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isSample` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_active_sortOrder_idx`(`active`, `sortOrder`),
    INDEX `Product_brandId_idx`(`brandId`),
    INDEX `Product_formId_idx`(`formId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `fileKey` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `alt` VARCHAR(200) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProductImage_fileKey_key`(`fileKey`),
    INDEX `ProductImage_productId_sortOrder_idx`(`productId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BulkPriceTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `minQuantity` INTEGER NOT NULL,
    `pricePaise` INTEGER NOT NULL,

    UNIQUE INDEX `BulkPriceTier_productId_minQuantity_key`(`productId`, `minQuantity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ProductPracticeAreas` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_ProductPracticeAreas_AB_unique`(`A`, `B`),
    INDEX `_ProductPracticeAreas_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BulkPriceTier` ADD CONSTRAINT `BulkPriceTier_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductPracticeAreas` ADD CONSTRAINT `_ProductPracticeAreas_A_fkey` FOREIGN KEY (`A`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductPracticeAreas` ADD CONSTRAINT `_ProductPracticeAreas_B_fkey` FOREIGN KEY (`B`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
