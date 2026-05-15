-- Phase 1a-1: Add tri-sem fields to subjects.
ALTER TABLE "subjects"
  ADD COLUMN "term_group_id" VARCHAR(64),
  ADD COLUMN "term_count" INTEGER NOT NULL DEFAULT 3;

UPDATE "subjects"
SET "term_group_id" = "modular_group_id"
WHERE "term_group_id" IS NULL AND "modular_group_id" IS NOT NULL;

CREATE INDEX "subjects_school_id_term_group_id_idx"
  ON "subjects"("school_id", "term_group_id");
