-- AlterTable
ALTER TABLE `Quiz` ADD COLUMN `categoryId` INTEGER NULL,
    ADD COLUMN `glyph` VARCHAR(8) NULL;

-- CreateTable
CREATE TABLE `QuizCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `name` VARCHAR(80) NOT NULL,
    `glyph` VARCHAR(8) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuizCategory_key_key`(`key`),
    INDEX `QuizCategory_active_sortOrder_idx`(`active`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Quiz_categoryId_idx` ON `Quiz`(`categoryId`);

-- AddForeignKey
ALTER TABLE `Quiz` ADD CONSTRAINT `Quiz_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `QuizCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
