-- Add modular subject rotation support.
-- Add optional modular_group_id/modular_order on subjects for quarter-based modular merging.

ALTER TABLE "subjects"
  ADD COLUMN "modular_group_id" VARCHAR(64),
  ADD COLUMN "modular_order" INTEGER;

CREATE INDEX "subjects_school_id_modular_group_id_idx"
  ON "subjects"("school_id", "modular_group_id");
