ALTER TABLE "scheduling_policies"
ADD COLUMN IF NOT EXISTS "show_special_events_in_grid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "enable_flag_ceremony" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "flag_ceremony_start_time" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS "flag_ceremony_end_time" TEXT NOT NULL DEFAULT '07:30',
ADD COLUMN IF NOT EXISTS "enable_recess" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "recess_start_time" TEXT NOT NULL DEFAULT '09:45',
ADD COLUMN IF NOT EXISTS "recess_end_time" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN IF NOT EXISTS "enable_lunch_window" BOOLEAN NOT NULL DEFAULT true;

UPDATE "scheduling_policies"
SET "enable_lunch_window" = "enforce_lunch_window"
WHERE "enable_lunch_window" IS DISTINCT FROM "enforce_lunch_window";