-- CreateTable
CREATE TABLE `ProductVariant` (
    `productId` INTEGER NOT NULL,
    `key` VARCHAR(24) NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `style` VARCHAR(24) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`productId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Products that had renamed variants get all four as rows, with their names.
INSERT INTO `ProductVariant` (`productId`, `key`, `name`, `style`, `sortOrder`)
SELECT p.`productId`, d.`key`, COALESCE(n.`name`, d.`name`), d.`key`, d.`sortOrder`
FROM (SELECT DISTINCT `productId` FROM `ProductVariantName`) p
CROSS JOIN (
    SELECT 'classic-green' AS `key`, 'Classic Green' AS `name`, 10 AS `sortOrder`
    UNION ALL SELECT 'saffron-glow', 'Saffron Glow', 20
    UNION ALL SELECT 'royal-maroon', 'Royal Maroon', 30
    UNION ALL SELECT 'minimal-white', 'Minimal White', 40
) d
LEFT JOIN `ProductVariantName` n ON n.`productId` = p.`productId` AND n.`variant` = d.`key`;

-- DropTable
DROP TABLE `ProductVariantName`;
