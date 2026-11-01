-- AlterTable
ALTER TABLE `User` ADD COLUMN `contactPhone` VARCHAR(20) NULL;

-- The new "Ayurveda Student" account type (also in src/server/seed/user-types.ts).
-- Added here so servers that only run the seed on first start get it too.
INSERT IGNORE INTO `UserType` (`key`, `label`, `isProfessional`, `requiresVerification`, `bulkPricing`, `sortOrder`, `active`, `createdAt`, `updatedAt`)
VALUES ('student', 'Ayurveda Student', true, true, false, 25, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
