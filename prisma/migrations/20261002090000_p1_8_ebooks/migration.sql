-- AlterTable
ALTER TABLE `CartItem` ADD COLUMN `ebookId` INTEGER NULL,
    MODIFY `productId` INTEGER NULL;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `ebookId` INTEGER NULL,
    ADD COLUMN `kind` ENUM('product', 'ebook') NOT NULL DEFAULT 'product';

-- CreateTable
CREATE TABLE `Ebook` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(120) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `author` VARCHAR(120) NULL,
    `description` TEXT NOT NULL,
    `isFree` BOOLEAN NOT NULL DEFAULT false,
    `pricePaise` INTEGER NOT NULL DEFAULT 0,
    `gstRate` INTEGER NOT NULL DEFAULT 18,
    `coverKey` VARCHAR(191) NULL,
    `coverContentType` VARCHAR(64) NULL,
    `fileKey` VARCHAR(191) NULL,
    `fileName` VARCHAR(160) NULL,
    `fileSizeBytes` INTEGER NULL,
    `downloadsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ebook_slug_key`(`slug`),
    UNIQUE INDEX `Ebook_coverKey_key`(`coverKey`),
    UNIQUE INDEX `Ebook_fileKey_key`(`fileKey`),
    INDEX `Ebook_active_sortOrder_idx`(`active`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CartItem_ebookId_idx` ON `CartItem`(`ebookId`);

-- CreateIndex
CREATE UNIQUE INDEX `CartItem_cartId_ebookId_key` ON `CartItem`(`cartId`, `ebookId`);

-- CreateIndex
CREATE INDEX `OrderItem_ebookId_idx` ON `OrderItem`(`ebookId`);

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_ebookId_fkey` FOREIGN KEY (`ebookId`) REFERENCES `Ebook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_ebookId_fkey` FOREIGN KEY (`ebookId`) REFERENCES `Ebook`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

