-- AlterTable
ALTER TABLE `Order` ADD COLUMN `type` ENUM('store', 'brand') NOT NULL DEFAULT 'store';

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `brandEligible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `brandMinQty` INTEGER NULL,
    ADD COLUMN `brandUnitLabel` VARCHAR(30) NULL,
    ADD COLUMN `brandUnitPricePaise` INTEGER NULL;

-- CreateTable
CREATE TABLE `BrandOrderDetails` (
    `orderId` VARCHAR(32) NOT NULL,
    `brandName` VARCHAR(80) NOT NULL,
    `tagline` VARCHAR(120) NULL,
    `marketedByName` VARCHAR(120) NULL,
    `marketedByAddress` VARCHAR(300) NULL,
    `contactPhone` VARCHAR(20) NULL,
    `notes` VARCHAR(1000) NULL,
    `logoKey` VARCHAR(191) NOT NULL,
    `logoName` VARCHAR(191) NOT NULL,
    `logoContentType` VARCHAR(64) NOT NULL,
    `logoSizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BrandOrderDetails_logoKey_key`(`logoKey`),
    PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrandDraft` (
    `userId` VARCHAR(64) NOT NULL,
    `productId` INTEGER NULL,
    `brandName` VARCHAR(80) NULL,
    `tagline` VARCHAR(120) NULL,
    `marketedByName` VARCHAR(120) NULL,
    `marketedByAddress` VARCHAR(300) NULL,
    `contactPhone` VARCHAR(20) NULL,
    `notes` VARCHAR(1000) NULL,
    `packagingDone` BOOLEAN NOT NULL DEFAULT false,
    `logoKey` VARCHAR(191) NULL,
    `logoName` VARCHAR(191) NULL,
    `logoContentType` VARCHAR(64) NULL,
    `logoSizeBytes` INTEGER NULL,
    `quantity` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BrandDraft_logoKey_key`(`logoKey`),
    INDEX `BrandDraft_productId_idx`(`productId`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_type_userId_createdAt_idx` ON `Order`(`type`, `userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Order_type_createdAt_idx` ON `Order`(`type`, `createdAt`);

-- CreateIndex
CREATE INDEX `Product_brandEligible_active_idx` ON `Product`(`brandEligible`, `active`);

-- AddForeignKey
ALTER TABLE `BrandOrderDetails` ADD CONSTRAINT `BrandOrderDetails_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandDraft` ADD CONSTRAINT `BrandDraft_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandDraft` ADD CONSTRAINT `BrandDraft_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Launch Your Brand links (P2.1): the seeded homepage links that pointed at
-- the homepage section now open /launch. Rows an admin already changed are
-- left alone.
UPDATE `HeroSlide` SET `primaryHref` = '/launch'
  WHERE `key` = 'launch-your-brand' AND `primaryHref` = '/#launch';
UPDATE `HeroSlide` SET `panel` = JSON_SET(`panel`, '$.nextHref', '/launch')
  WHERE `key` = 'launch-your-brand' AND `panelKind` = 'LAUNCH_STUDIO'
    AND JSON_TYPE(JSON_EXTRACT(`panel`, '$.nextHref')) = 'NULL';
UPDATE `Reel` SET `linkHref` = '/launch'
  WHERE `key` = 'brand-launch' AND `linkHref` = '/#launch';
UPDATE `Offer` SET `linkHref` = '/launch'
  WHERE `key` = 'private-label' AND `linkHref` = '/#launch';
UPDATE `QuickAction` SET `href` = '/launch'
  WHERE `key` = 'launch-your-brand' AND `href` = '/#launch';
