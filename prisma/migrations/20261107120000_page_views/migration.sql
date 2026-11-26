-- CreateTable
CREATE TABLE `PageView` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `day` VARCHAR(10) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `section` VARCHAR(24) NOT NULL,
    `userTypeId` INTEGER NULL,
    `device` VARCHAR(12) NOT NULL,
    `visitor` VARCHAR(32) NOT NULL,

    INDEX `PageView_day_idx`(`day`),
    INDEX `PageView_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageViewDaily` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `day` VARCHAR(10) NOT NULL,
    `kind` VARCHAR(12) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `views` INTEGER NOT NULL,
    `visitors` INTEGER NOT NULL,

    INDEX `PageViewDaily_kind_day_idx`(`kind`, `day`),
    UNIQUE INDEX `PageViewDaily_day_kind_key_key`(`day`, `kind`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
