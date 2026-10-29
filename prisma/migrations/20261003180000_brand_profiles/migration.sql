-- Brand profiles and label specs (Launch Your Brand): users save brands to
-- reuse (BrandProfile), each product has a label spec (LabelSpec) saying what
-- its label can print, each cart line can override label fields for its
-- product (BrandCartItem.labelOverrides), and the order keeps the label as
-- approved (OrderItem.labelDetails).

-- AlterTable
ALTER TABLE `BrandCartItem` ADD COLUMN `labelOverrides` JSON NULL;

-- AlterTable
ALTER TABLE `BrandDraft` ADD COLUMN `profileId` INTEGER NULL;

-- AlterTable
ALTER TABLE `BrandOrderDetails` ADD COLUMN `licenceNumbers` VARCHAR(300) NULL,
    ADD COLUMN `longDescription` VARCHAR(600) NULL,
    ADD COLUMN `primaryColour` VARCHAR(7) NULL,
    ADD COLUMN `secondaryColour` VARCHAR(7) NULL,
    ADD COLUMN `shortDescription` VARCHAR(160) NULL;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `labelDetails` JSON NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `labelSpecId` INTEGER NULL;

-- CreateTable
CREATE TABLE `BrandProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NOT NULL,
    `profileName` VARCHAR(60) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `brandName` VARCHAR(80) NOT NULL,
    `tagline` VARCHAR(120) NULL,
    `shortDescription` VARCHAR(160) NULL,
    `longDescription` VARCHAR(600) NULL,
    `marketedByName` VARCHAR(120) NULL,
    `marketedByAddress` VARCHAR(300) NULL,
    `contactPhone` VARCHAR(20) NULL,
    `licenceNumbers` VARCHAR(300) NULL,
    `primaryColour` VARCHAR(7) NULL,
    `secondaryColour` VARCHAR(7) NULL,
    `logoKey` VARCHAR(191) NULL,
    `logoName` VARCHAR(191) NULL,
    `logoContentType` VARCHAR(64) NULL,
    `logoSizeBytes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BrandProfile_logoKey_key`(`logoKey`),
    INDEX `BrandProfile_userId_isDefault_idx`(`userId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LabelSpec` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `widthMm` INTEGER NOT NULL,
    `heightMm` INTEGER NOT NULL,
    `logoWidthMm` INTEGER NOT NULL,
    `logoHeightMm` INTEGER NOT NULL,
    `logoPlacement` ENUM('top_left', 'top_center', 'top_right', 'center', 'bottom_center') NOT NULL,
    `descriptionSource` ENUM('short', 'long') NOT NULL DEFAULT 'short',
    `limits` JSON NOT NULL,

    UNIQUE INDEX `LabelSpec_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `BrandDraft_profileId_idx` ON `BrandDraft`(`profileId`);


-- Saved brand profiles: a draft's packaging (brand name, logo...) becomes the
-- user's default profile, and the draft points at it. Only the notes and the
-- "packaging done" flag stay on the draft.
INSERT INTO `BrandProfile` (`userId`, `profileName`, `isDefault`, `brandName`, `tagline`, `marketedByName`, `marketedByAddress`, `contactPhone`, `logoKey`, `logoName`, `logoContentType`, `logoSizeBytes`, `createdAt`, `updatedAt`)
SELECT `userId`, COALESCE(`brandName`, 'My brand'), true, COALESCE(`brandName`, 'My brand'), `tagline`, `marketedByName`, `marketedByAddress`, `contactPhone`, `logoKey`, `logoName`, `logoContentType`, `logoSizeBytes`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `BrandDraft` WHERE `brandName` IS NOT NULL OR `logoKey` IS NOT NULL;

UPDATE `BrandDraft` d JOIN `BrandProfile` p ON p.`userId` = d.`userId` SET d.`profileId` = p.`id`;

-- A moved draft has to be confirmed again (its label details are new).
UPDATE `BrandDraft` SET `packagingDone` = false;

-- DropIndex
DROP INDEX `BrandDraft_logoKey_key` ON `BrandDraft`;

-- AlterTable
ALTER TABLE `BrandDraft` DROP COLUMN `brandName`,
    DROP COLUMN `contactPhone`,
    DROP COLUMN `logoContentType`,
    DROP COLUMN `logoKey`,
    DROP COLUMN `logoName`,
    DROP COLUMN `logoSizeBytes`,
    DROP COLUMN `marketedByAddress`,
    DROP COLUMN `marketedByName`,
    DROP COLUMN `tagline`;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_labelSpecId_fkey` FOREIGN KEY (`labelSpecId`) REFERENCES `LabelSpec`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandDraft` ADD CONSTRAINT `BrandDraft_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `BrandProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandProfile` ADD CONSTRAINT `BrandProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

