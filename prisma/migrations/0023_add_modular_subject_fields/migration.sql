-- Add modular subject rotation support.
-- 1) Extend session_pattern enum with FRIDAY_ONLY for targeted enrichment subjects.
-- 2) Add optional modular_group_id/modular_order on subjects for quarter-based modular merging.

ALTER TYPE "session_pattern" ADD VALUE IF NOT EXISTS 'FRIDAY_ONLY';

ALTER TABLE "subjects"
  ADD COLUMN "modular_group_id" VARCHAR(64),
  ADD COLUMN "modular_order" INTEGER;

CREATE INDEX "subjects_school_id_modular_group_id_idx"
  ON "subjects"("school_id", "modular_group_id");
