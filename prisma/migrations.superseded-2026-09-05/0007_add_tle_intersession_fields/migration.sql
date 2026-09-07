-- Add inter-section scheduling fields to subjects table
ALTER TABLE "subjects"
ADD COLUMN IF NOT EXISTS "inter_section_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "inter_section_grade_levels" INTEGER[] NOT NULL DEFAULT '{}';

-- Add TLE two-pass priority field to scheduling_policies table
ALTER TABLE "scheduling_policies"
ADD COLUMN IF NOT EXISTS "enable_tle_two_pass_priority" BOOLEAN NOT NULL DEFAULT true;
