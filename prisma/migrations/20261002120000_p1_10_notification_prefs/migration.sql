-- AlterTable
ALTER TABLE `User` ADD COLUMN `notifyOrderEmail` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifyOrderSms` BOOLEAN NOT NULL DEFAULT true;
