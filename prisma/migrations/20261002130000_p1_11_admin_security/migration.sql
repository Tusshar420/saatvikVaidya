-- AlterTable
ALTER TABLE `User` ADD COLUMN `adminRole` ENUM('super', 'catalogue', 'orders', 'content', 'approvals') NULL,
    ADD COLUMN `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `TwoFactor` (
    `id` VARCHAR(64) NOT NULL,
    `secret` TEXT NOT NULL,
    `backupCodes` TEXT NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT true,
    `failedVerificationCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,

    INDEX `TwoFactor_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminInvite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `adminRole` ENUM('super', 'catalogue', 'orders', 'content', 'approvals') NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `invitedById` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminInvite_tokenHash_key`(`tokenHash`),
    INDEX `AdminInvite_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TwoFactor` ADD CONSTRAINT `TwoFactor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminInvite` ADD CONSTRAINT `AdminInvite_invitedById_fkey` FOREIGN KEY (`invitedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Admins that existed before roles become super admins; they set up
-- two-factor at their next sign-in.
UPDATE `User` SET `adminRole` = 'super' WHERE `role` = 'admin';
