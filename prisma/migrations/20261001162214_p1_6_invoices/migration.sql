-- CreateTable
CREATE TABLE `InvoiceSequence` (
    `kind` ENUM('invoice', 'credit_note') NOT NULL,
    `financialYear` CHAR(7) NOT NULL,
    `lastNumber` INTEGER NOT NULL,

    PRIMARY KEY (`kind`, `financialYear`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('invoice', 'credit_note') NOT NULL,
    `number` VARCHAR(16) NOT NULL,
    `financialYear` CHAR(7) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `orderId` VARCHAR(32) NOT NULL,
    `originalId` INTEGER NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `seller` JSON NOT NULL,
    `buyer` JSON NOT NULL,
    `placeOfSupply` VARCHAR(4) NOT NULL,
    `interState` BOOLEAN NOT NULL,
    `taxablePaise` INTEGER NOT NULL,
    `cgstPaise` INTEGER NOT NULL,
    `sgstPaise` INTEGER NOT NULL,
    `igstPaise` INTEGER NOT NULL,
    `totalPaise` INTEGER NOT NULL,
    `testPayment` BOOLEAN NOT NULL DEFAULT false,
    `fileKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invoice_number_key`(`number`),
    UNIQUE INDEX `Invoice_fileKey_key`(`fileKey`),
    INDEX `Invoice_issuedAt_idx`(`issuedAt`),
    UNIQUE INDEX `Invoice_orderId_kind_key`(`orderId`, `kind`),
    UNIQUE INDEX `Invoice_kind_financialYear_sequence_key`(`kind`, `financialYear`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceId` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `hsnCode` VARCHAR(8) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPaise` INTEGER NOT NULL,
    `gstRate` INTEGER NOT NULL,
    `taxablePaise` INTEGER NOT NULL,
    `cgstPaise` INTEGER NOT NULL,
    `sgstPaise` INTEGER NOT NULL,
    `igstPaise` INTEGER NOT NULL,
    `totalPaise` INTEGER NOT NULL,

    UNIQUE INDEX `InvoiceLine_invoiceId_position_key`(`invoiceId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_originalId_fkey` FOREIGN KEY (`originalId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
