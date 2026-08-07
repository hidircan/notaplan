-- ÖNCELİK 4 (devam) — Program ekranına akademik dönem (Güz/Yaz) + akademik
-- yıl. Her iki sütun da NULLABLE eklenir: mevcut Lesson/LessonSeries
-- kayıtları hiçbir veri kaybı olmadan "legacy" (term=NULL, academicYearStart=
-- NULL) olarak kalır. Bilinçli olarak backfill/UPDATE YOK — okuma tarafı
-- (src/lib/attendance-calendar.ts resolveLessonAcademicPeriod) NULL için
-- tarihe dayalı güvenli bir fallback uygular; bu, canlı bir tabloda riskli
-- bir toplu UPDATE'ten kaçınmak için bilinçli bir mimari tercihtir.

ALTER TABLE `LessonSeries`
  ADD COLUMN `term` VARCHAR(191) NULL,
  ADD COLUMN `academicYearStart` INTEGER NULL;

ALTER TABLE `Lesson`
  ADD COLUMN `term` VARCHAR(191) NULL,
  ADD COLUMN `academicYearStart` INTEGER NULL;

CREATE INDEX `LessonSeries_tenantId_term_academicYearStart_idx` ON `LessonSeries`(`tenantId`, `term`, `academicYearStart`);
CREATE INDEX `Lesson_tenantId_term_academicYearStart_idx` ON `Lesson`(`tenantId`, `term`, `academicYearStart`);
