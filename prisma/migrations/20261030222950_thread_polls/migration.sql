-- CreateTable
CREATE TABLE `ThreadPollOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `threadId` INTEGER NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `position` INTEGER NOT NULL,

    INDEX `ThreadPollOption_threadId_position_idx`(`threadId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreadPollVote` (
    `threadId` INTEGER NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `optionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ThreadPollVote_optionId_idx`(`optionId`),
    PRIMARY KEY (`threadId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ThreadPollOption` ADD CONSTRAINT `ThreadPollOption_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `Thread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreadPollVote` ADD CONSTRAINT `ThreadPollVote_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `Thread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreadPollVote` ADD CONSTRAINT `ThreadPollVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreadPollVote` ADD CONSTRAINT `ThreadPollVote_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `ThreadPollOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
