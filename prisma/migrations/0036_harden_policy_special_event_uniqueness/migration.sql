-- Replace weak nullable-column unique index with PostgreSQL-safe partial unique indexes.
-- The old index (school_id, school_year_id, event_type, grade_group, program_type) does not
-- prevent duplicate global rows because PostgreSQL treats NULLs as distinct in unique indexes.
-- This migration is idempotent.

DROP INDEX IF EXISTS "uq_policy_special_events_scope";

-- 1. Global events: grade_group IS NULL AND program_type IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pse_global"
    ON "policy_special_events"("school_id", "school_year_id", "event_type")
    WHERE "grade_group" IS NULL AND "program_type" IS NULL;

-- 2. Program-global events: grade_group IS NULL AND program_type IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pse_program_global"
    ON "policy_special_events"("school_id", "school_year_id", "event_type", "program_type")
    WHERE "grade_group" IS NULL AND "program_type" IS NOT NULL;

-- 3. Shift-default events: grade_group IS NOT NULL AND program_type IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pse_shift_default"
    ON "policy_special_events"("school_id", "school_year_id", "event_type", "grade_group")
    WHERE "grade_group" IS NOT NULL AND "program_type" IS NULL;

-- 4. Shift-program events: grade_group IS NOT NULL AND program_type IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pse_shift_program"
    ON "policy_special_events"("school_id", "school_year_id", "event_type", "grade_group", "program_type")
    WHERE "grade_group" IS NOT NULL AND "program_type" IS NOT NULL;
