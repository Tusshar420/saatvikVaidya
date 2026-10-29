-- CreateTable
CREATE TABLE `ErrorGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fingerprint` VARCHAR(64) NOT NULL,
    `source` ENUM('server', 'browser') NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `stack` TEXT NULL,
    `route` VARCHAR(191) NOT NULL,
    `method` VARCHAR(10) NULL,
    `statusCode` INTEGER NULL,
    `status` ENUM('new', 'investigating', 'fixed', 'ignored') NOT NULL DEFAULT 'new',
    `count` INTEGER NOT NULL DEFAULT 1,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastNotifiedAt` DATETIME(3) NULL,
    `appVersion` VARCHAR(40) NULL,

    UNIQUE INDEX `ErrorGroup_fingerprint_key`(`fingerprint`),
    INDEX `ErrorGroup_status_lastSeenAt_idx`(`status`, `lastSeenAt`),
    INDEX `ErrorGroup_source_lastSeenAt_idx`(`source`, `lastSeenAt`),
    INDEX `ErrorGroup_route_idx`(`route`),
    INDEX `ErrorGroup_count_idx`(`count`),
    INDEX `ErrorGroup_lastSeenAt_idx`(`lastSeenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ErrorOccurrence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `url` VARCHAR(500) NULL,
    `method` VARCHAR(10) NULL,
    `statusCode` INTEGER NULL,
    `userId` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `device` VARCHAR(12) NULL,
    `appVersion` VARCHAR(40) NULL,
    `stack` TEXT NULL,
    `context` JSON NULL,

    INDEX `ErrorOccurrence_groupId_createdAt_idx`(`groupId`, `createdAt`),
    INDEX `ErrorOccurrence_createdAt_idx`(`createdAt`),
    INDEX `ErrorOccurrence_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ErrorOccurrence` ADD CONSTRAINT `ErrorOccurrence_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ErrorGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ErrorOccurrence` ADD CONSTRAINT `ErrorOccurrence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
