-- AlterTable
ALTER TABLE `CoinLedger` MODIFY `reason` ENUM('earn_order', 'earn_reversal', 'earn_quiz', 'earn_profile', 'redeem', 'redeem_return', 'admin_adjust') NOT NULL;

-- AlterTable
ALTER TABLE `Quiz` ADD COLUMN `endsAt` DATETIME(3) NULL,
    ADD COLUMN `passPercent` INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN `startsAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `QuizQuestion` ADD COLUMN `explanation` VARCHAR(400) NULL;

-- CreateTable
CREATE TABLE `QuizAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NOT NULL,
    `quizId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `answers` JSON NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `score` INTEGER NOT NULL DEFAULT 0,
    `maxScore` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `timeTakenSeconds` INTEGER NOT NULL DEFAULT 0,
    `coinsAwarded` INTEGER NOT NULL DEFAULT 0,

    INDEX `QuizAttempt_quizId_submittedAt_idx`(`quizId`, `submittedAt`),
    INDEX `QuizAttempt_startedAt_idx`(`startedAt`),
    UNIQUE INDEX `QuizAttempt_userId_quizId_key`(`userId`, `quizId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Quiz_active_startsAt_idx` ON `Quiz`(`active`, `startsAt`);

-- AddForeignKey
ALTER TABLE `QuizAttempt` ADD CONSTRAINT `QuizAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizAttempt` ADD CONSTRAINT `QuizAttempt_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- The homepage's "play the quiz" links now open /quiz.
UPDATE `HeroSlide` SET `secondaryHref` = '/quiz' WHERE `secondaryHref` = '/#quiz';
UPDATE `Offer` SET `linkHref` = '/quiz' WHERE `linkHref` = '/#quiz';
