-- Phase 1a-3 + 1b-1: Add placeholder flag and ancillary source-of-truth fields to faculty mirrors.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ancillary_load_source') THEN
    CREATE TYPE "ancillary_load_source" AS ENUM ('HR', 'LOCAL', 'NONE');
  END IF;
END $$;

ALTER TABLE "faculty_mirrors"
  ADD COLUMN "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ancillary_minutes_per_week" INTEGER,
  ADD COLUMN "ancillary_load_source" "ancillary_load_source" NOT NULL DEFAULT 'NONE';

CREATE INDEX "faculty_mirrors_is_placeholder_idx"
  ON "faculty_mirrors"("is_placeholder");

CREATE INDEX "faculty_mirrors_ancillary_load_source_idx"
  ON "faculty_mirrors"("ancillary_load_source");
