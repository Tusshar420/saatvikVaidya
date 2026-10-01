-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('pending_payment', 'paid', 'payment_failed', 'cancelled', 'processing', 'shipped', 'delivered', 'returned') NOT NULL DEFAULT 'pending_payment';

-- CreateTable
CREATE TABLE `Shipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(32) NOT NULL,
    `provider` VARCHAR(20) NOT NULL,
    `courierName` VARCHAR(80) NOT NULL,
    `awb` VARCHAR(40) NOT NULL,
    `status` ENUM('created', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'undelivered', 'returned', 'cancelled') NOT NULL DEFAULT 'created',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Shipment_orderId_key`(`orderId`),
    UNIQUE INDEX `Shipment_awb_key`(`awb`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shipmentId` INTEGER NOT NULL,
    `status` ENUM('created', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'undelivered', 'returned', 'cancelled') NOT NULL,
    `location` VARCHAR(100) NULL,
    `note` VARCHAR(200) NULL,
    `actorId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShipmentEvent_shipmentId_createdAt_idx`(`shipmentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentEvent` ADD CONSTRAINT `ShipmentEvent_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
