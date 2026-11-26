-- CreateTable
CREATE TABLE `ProductVariantName` (
    `productId` INTEGER NOT NULL,
    `variant` VARCHAR(24) NOT NULL,
    `name` VARCHAR(40) NOT NULL,

    PRIMARY KEY (`productId`, `variant`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductVariantName` ADD CONSTRAINT `ProductVariantName_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
