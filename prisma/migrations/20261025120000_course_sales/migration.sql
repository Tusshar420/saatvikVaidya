-- AlterTable
ALTER TABLE `CartItem` ADD COLUMN `courseId` INTEGER NULL;

-- AlterTable
ALTER TABLE `CourseTeaser` ADD COLUMN `accessDetails` TEXT NULL,
    ADD COLUMN `authorId` VARCHAR(64) NULL,
    ADD COLUMN `details` TEXT NULL,
    ADD COLUMN `gstRate` INTEGER NOT NULL DEFAULT 18,
    ADD COLUMN `pricePaise` INTEGER NULL,
    ADD COLUMN `reviewNote` VARCHAR(500) NULL,
    ADD COLUMN `status` ENUM('pending', 'published', 'rejected') NOT NULL DEFAULT 'published',
    ADD COLUMN `submittedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `courseId` INTEGER NULL,
    MODIFY `kind` ENUM('product', 'ebook', 'course') NOT NULL DEFAULT 'product';

-- CreateIndex
CREATE INDEX `CartItem_courseId_idx` ON `CartItem`(`courseId`);

-- CreateIndex
CREATE UNIQUE INDEX `CartItem_cartId_courseId_key` ON `CartItem`(`cartId`, `courseId`);

-- CreateIndex
CREATE INDEX `CourseTeaser_authorId_idx` ON `CourseTeaser`(`authorId`);

-- CreateIndex
CREATE INDEX `CourseTeaser_status_idx` ON `CourseTeaser`(`status`);

-- CreateIndex
CREATE INDEX `OrderItem_courseId_idx` ON `OrderItem`(`courseId`);

-- AddForeignKey
ALTER TABLE `CourseTeaser` ADD CONSTRAINT `CourseTeaser_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `CourseTeaser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `CourseTeaser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

