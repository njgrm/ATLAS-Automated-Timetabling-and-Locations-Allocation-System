-- Annual Teaching Load scope. Existing unscoped rows remain legacy evidence.
ALTER TABLE "faculty_subjects"
  ADD COLUMN "school_year_id" INTEGER;

ALTER TABLE "subject_section_ownerships"
  ADD COLUMN "school_year_id" INTEGER;

DROP INDEX IF EXISTS "uq_faculty_subject";
CREATE UNIQUE INDEX "uq_faculty_subject_year"
  ON "faculty_subjects"("faculty_id", "subject_id", "school_year_id");
CREATE INDEX "faculty_subjects_school_id_school_year_id_idx"
  ON "faculty_subjects"("school_id", "school_year_id");

DROP INDEX IF EXISTS "uq_subject_section_owner";
CREATE UNIQUE INDEX "uq_subject_section_owner_year"
  ON "subject_section_ownerships"("school_id", "school_year_id", "subject_id", "section_id");
CREATE INDEX "subject_section_ownerships_school_id_school_year_id_subject_id_idx"
  ON "subject_section_ownerships"("school_id", "school_year_id", "subject_id");

CREATE TYPE "teaching_load_cycle_state" AS ENUM ('EMPTY', 'POPULATED');

CREATE TABLE "teaching_load_cycles" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL,
  "school_year_id" INTEGER NOT NULL,
  "state" "teaching_load_cycle_state" NOT NULL DEFAULT 'EMPTY',
  "version" INTEGER NOT NULL DEFAULT 1,
  "initialized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teaching_load_cycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_teaching_load_cycle"
  ON "teaching_load_cycles"("school_id", "school_year_id");
CREATE INDEX "teaching_load_cycles_school_id_school_year_id_state_idx"
  ON "teaching_load_cycles"("school_id", "school_year_id", "state");

ALTER TABLE "teaching_load_cycles"
  ADD CONSTRAINT "teaching_load_cycles_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
