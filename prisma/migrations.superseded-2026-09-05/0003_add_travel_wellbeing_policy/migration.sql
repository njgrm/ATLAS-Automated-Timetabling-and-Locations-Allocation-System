-- Add travel/well-being soft constraint policy fields to scheduling_policies

ALTER TABLE "scheduling_policies"
  ADD COLUMN "enable_travel_wellbeing_checks" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "max_walking_distance_meters_per_transition" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "max_building_transitions_per_day" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "max_back_to_back_transitions_without_buffer" INTEGER NOT NULL DEFAULT 2;
