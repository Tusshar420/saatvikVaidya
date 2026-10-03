-- CreateTable
CREATE TABLE `BugReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `status` ENUM('new', 'investigating', 'fixed', 'ignored') NOT NULL DEFAULT 'new',
    `description` TEXT NOT NULL,
    `userId` VARCHAR(64) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `pageUrl` VARCHAR(500) NULL,
    `userAgent` VARCHAR(255) NULL,
    `device` VARCHAR(12) NULL,
    `screenWidth` INTEGER NULL,
    `screenHeight` INTEGER NULL,
    `viewportWidth` INTEGER NULL,
    `viewportHeight` INTEGER NULL,
    `pixelRatio` DOUBLE NULL,
    `appVersion` VARCHAR(40) NULL,
    `sessionErrors` JSON NULL,
    `screenshotKey` VARCHAR(191) NULL,
    `screenshotType` VARCHAR(32) NULL,
    `adminNote` TEXT NULL,

    UNIQUE INDEX `BugReport_screenshotKey_key`(`screenshotKey`),
    INDEX `BugReport_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `BugReport_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `BugReport_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BugReportError` (
    `reportId` INTEGER NOT NULL,
    `groupId` INTEGER NOT NULL,
    `auto` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BugReportError_groupId_idx`(`groupId`),
    PRIMARY KEY (`reportId`, `groupId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BugReport` ADD CONSTRAINT `BugReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BugReportError` ADD CONSTRAINT `BugReportError_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `BugReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BugReportError` ADD CONSTRAINT `BugReportError_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ErrorGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
