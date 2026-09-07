-- Add global lunch window policy fields to scheduling_policies
ALTER TABLE "scheduling_policies"
  ADD COLUMN "lunch_start_time" TEXT NOT NULL DEFAULT '11:55',
  ADD COLUMN "lunch_end_time" TEXT NOT NULL DEFAULT '12:55',
  ADD COLUMN "enforce_lunch_window" BOOLEAN NOT NULL DEFAULT true;
