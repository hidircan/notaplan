-- `TaskReminderLog`'daki 5 sütunlu benzersiz index, utf8mb4 altında
-- VARCHAR(191) x 5 = 3820 bayt olduğu için MySQL'in 3072 bayt anahtar
-- sınırını aşıyordu ("Specified key was too long"). Gerçek değerler zaten
-- çok daha kısa (bkz. src/lib/utils.ts uid(), kind: DUE_SOON/DUE_TODAY/
-- OVERDUE, calendarDay: yyyy-MM-dd) — veri kaybı olmadan sütun uzunlukları
-- daraltıldı (100+100+100+20+10 = 330 karakter × 4 bayt = 1320 bayt).

ALTER TABLE `TaskReminderLog`
  MODIFY COLUMN `tenantId` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `taskId` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `assigneeUserId` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `kind` VARCHAR(20) NOT NULL,
  MODIFY COLUMN `calendarDay` VARCHAR(10) NOT NULL;
