-- AlterTable
ALTER TABLE `Notification` MODIFY `kind` ENUM('order', 'brand', 'verification', 'admin', 'course', 'doctor_talk', 'quiz', 'top_brands') NOT NULL;
