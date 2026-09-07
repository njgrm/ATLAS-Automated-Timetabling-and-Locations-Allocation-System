-- Add idle-gap, early/late preferences, and constraint-config JSON to scheduling_policies

ALTER TABLE "scheduling_policies"
  ADD COLUMN "max_idle_gap_minutes_per_day" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "avoid_early_first_period" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "avoid_late_last_period" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "constraint_config" JSONB;
