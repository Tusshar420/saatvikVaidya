-- CreateTable
CREATE TABLE `ThreadImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `threadId` INTEGER NOT NULL,
    `fileKey` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(32) NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ThreadImage_fileKey_key`(`fileKey`),
    INDEX `ThreadImage_threadId_position_idx`(`threadId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ThreadImage` ADD CONSTRAINT `ThreadImage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `Thread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
