-- Workload policy fields for teaching standard, advisory credit, and hard cap.
-- Extends existing SchedulingPolicy per-(schoolId, schoolYearId) container.

ALTER TABLE "scheduling_policies"
ADD COLUMN IF NOT EXISTS "teaching_standard_minutes" INTEGER NOT NULL DEFAULT 1800,
ADD COLUMN IF NOT EXISTS "advisory_credit_minutes" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN IF NOT EXISTS "hard_cap_minutes" INTEGER NOT NULL DEFAULT 2400;
