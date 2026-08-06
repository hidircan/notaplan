ALTER TABLE `TeacherFeedback`
  ADD COLUMN `continueWithTeacher` VARCHAR(191) NULL,
  ADD COLUMN `sharedWithTeacher` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `TeacherFeedback_tenantId_studentId_teacherId_idx` ON `TeacherFeedback`(`tenantId`, `studentId`, `teacherId`);
