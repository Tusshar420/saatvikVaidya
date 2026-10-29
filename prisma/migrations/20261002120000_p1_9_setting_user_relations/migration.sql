-- Ids of users that no longer exist (or were never real) can't satisfy the
-- new foreign keys; the history keeps the change, just without who made it.
UPDATE `Setting` SET `updatedBy` = NULL WHERE `updatedBy` IS NOT NULL AND `updatedBy` NOT IN (SELECT `id` FROM `User`);
UPDATE `SettingHistory` SET `changedBy` = NULL WHERE `changedBy` IS NOT NULL AND `changedBy` NOT IN (SELECT `id` FROM `User`);

-- AlterTable
ALTER TABLE `Setting` MODIFY `updatedBy` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `SettingHistory` MODIFY `changedBy` VARCHAR(64) NULL;

-- CreateIndex
CREATE INDEX `Setting_updatedBy_idx` ON `Setting`(`updatedBy`);

-- CreateIndex
CREATE INDEX `SettingHistory_changedBy_idx` ON `SettingHistory`(`changedBy`);

-- AddForeignKey
ALTER TABLE `Setting` ADD CONSTRAINT `Setting_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettingHistory` ADD CONSTRAINT `SettingHistory_changedBy_fkey` FOREIGN KEY (`changedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

