-- AlterTable
ALTER TABLE `User` ADD COLUMN `verificationSubmittedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `ProfessionalDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NOT NULL,
    `documentType` VARCHAR(40) NOT NULL,
    `fileKey` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verifiedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ProfessionalDocument_fileKey_key`(`fileKey`),
    UNIQUE INDEX `ProfessionalDocument_userId_documentType_key`(`userId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(64) NOT NULL,
    `authorId` VARCHAR(64) NULL,
    `decision` ENUM('approved', 'rejected') NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VerificationComment_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `VerificationComment_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProfessionalDocument` ADD CONSTRAINT `ProfessionalDocument_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationComment` ADD CONSTRAINT `VerificationComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationComment` ADD CONSTRAINT `VerificationComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
