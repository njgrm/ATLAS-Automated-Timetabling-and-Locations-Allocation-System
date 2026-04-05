-- Add vacant-aware scheduling policy fields
ALTER TABLE "scheduling_policies"
  ADD COLUMN "enable_vacant_aware_constraints" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "target_faculty_daily_vacant_minutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "target_section_daily_vacant_periods" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "max_compressed_teaching_minutes_per_day" INTEGER NOT NULL DEFAULT 300;
