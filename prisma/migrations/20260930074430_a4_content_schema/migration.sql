-- CreateTable
CREATE TABLE `UserType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(40) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `isProfessional` BOOLEAN NOT NULL DEFAULT false,
    `requiresVerification` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserType_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettingHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `settingKey` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changedBy` VARCHAR(191) NULL,

    INDEX `SettingHistory_settingKey_changedAt_idx`(`settingKey`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeSection` (
    `key` VARCHAR(40) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `eyebrow` VARCHAR(80) NULL,
    `title` VARCHAR(160) NULL,
    `titleEmphasis` VARCHAR(160) NULL,
    `description` VARCHAR(400) NULL,
    `linkLabel` VARCHAR(80) NULL,
    `linkHref` VARCHAR(200) NULL,
    `content` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HeroSlide` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `eyebrow` VARCHAR(80) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `titleEmphasis` VARCHAR(160) NULL,
    `body` VARCHAR(400) NOT NULL,
    `primaryLabel` VARCHAR(80) NOT NULL,
    `primaryHref` VARCHAR(200) NULL,
    `secondaryLabel` VARCHAR(80) NULL,
    `secondaryHref` VARCHAR(200) NULL,
    `proof` JSON NULL,
    `panelKind` ENUM('LAUNCH_STUDIO', 'BRAND_SHOWCASE', 'LEARNING_BOARD') NOT NULL,
    `panel` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HeroSlide_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StatItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `value` VARCHAR(40) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StatItem_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `type` ENUM('PRODUCT', 'FEEDBACK', 'LEARNING', 'OFFER') NOT NULL,
    `mediaKind` ENUM('VIDEO', 'IMAGE', 'POSTER') NOT NULL,
    `mediaSrc` VARCHAR(200) NULL,
    `posterSrc` VARCHAR(200) NULL,
    `mediaLabel` VARCHAR(200) NULL,
    `badge` VARCHAR(60) NULL,
    `badgeTone` ENUM('ORANGE', 'TEAL', 'BLUE', 'GOLD', 'NAVY', 'GREEN') NULL,
    `metaLabel` VARCHAR(60) NULL,
    `valueLabel` VARCHAR(60) NULL,
    `posterKicker` VARCHAR(80) NULL,
    `posterText` VARCHAR(200) NULL,
    `posterByline` VARCHAR(80) NULL,
    `title` VARCHAR(200) NOT NULL,
    `linkLabel` VARCHAR(80) NOT NULL,
    `linkHref` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Reel_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Offer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `tone` ENUM('ORANGE', 'TEAL', 'BLUE', 'GOLD', 'NAVY', 'GREEN') NOT NULL,
    `iconText` VARCHAR(8) NOT NULL,
    `eyebrow` VARCHAR(80) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `body` VARCHAR(300) NOT NULL,
    `linkLabel` VARCHAR(80) NOT NULL,
    `linkHref` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Offer_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuickAction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `tone` ENUM('ORANGE', 'TEAL', 'BLUE', 'GOLD', 'NAVY', 'GREEN') NOT NULL,
    `iconText` VARCHAR(8) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `description` VARCHAR(160) NOT NULL,
    `href` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuickAction_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `kind` ENUM('FORM', 'PRACTICE_AREA') NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `name` VARCHAR(80) NOT NULL,
    `glyph` VARCHAR(8) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Brand` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `name` VARCHAR(80) NOT NULL,
    `monogram` VARCHAR(4) NOT NULL,
    `tone` ENUM('ORANGE', 'TEAL', 'BLUE', 'GOLD', 'NAVY', 'GREEN') NOT NULL,
    `eyebrow` VARCHAR(80) NOT NULL,
    `description` VARCHAR(300) NOT NULL,
    `linkLabel` VARCHAR(80) NOT NULL,
    `linkHref` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Brand_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseTeaser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `tag` VARCHAR(60) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `body` VARCHAR(300) NOT NULL,
    `metaLabel` VARCHAR(40) NOT NULL,
    `metaValue` VARCHAR(80) NOT NULL,
    `linkLabel` VARCHAR(80) NOT NULL,
    `linkHref` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CourseTeaser_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `tag` VARCHAR(60) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `body` VARCHAR(300) NOT NULL,
    `metaLabel` VARCHAR(40) NOT NULL,
    `metaValue` VARCHAR(80) NOT NULL,
    `linkLabel` VARCHAR(80) NOT NULL,
    `linkHref` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LiveSession_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `imageSrc` VARCHAR(200) NOT NULL,
    `imageAlt` VARCHAR(200) NOT NULL,
    `badge` VARCHAR(60) NOT NULL,
    `quote` VARCHAR(600) NOT NULL,
    `caption` VARCHAR(160) NOT NULL,
    `linkLabel` VARCHAR(80) NOT NULL,
    `linkHref` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Feedback_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhyStep` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `title` VARCHAR(80) NOT NULL,
    `body` VARCHAR(300) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WhyStep_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SettingHistory` ADD CONSTRAINT `SettingHistory_settingKey_fkey` FOREIGN KEY (`settingKey`) REFERENCES `Setting`(`key`) ON DELETE CASCADE ON UPDATE CASCADE;
