-- AlterTable: add well-being preference toggles to faculty_preferences
ALTER TABLE "faculty_preferences" ADD COLUMN IF NOT EXISTS "pregnancy_support" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "faculty_preferences" ADD COLUMN IF NOT EXISTS "physical_ailment_support" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "faculty_preferences" ADD COLUMN IF NOT EXISTS "minimize_travel_time" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "faculty_preferences" ADD COLUMN IF NOT EXISTS "avoid_upper_floors" BOOLEAN NOT NULL DEFAULT false;
