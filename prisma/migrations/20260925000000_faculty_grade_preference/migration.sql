-- FACULTY-GRADE-PREFERENCE-C01 (decision D10): ATLAS-owned soft grade
-- preference, keyed (school_id, faculty_id) with NO school_year_id so it
-- persists across rollover and is never cleared by the EnrollPro faculty sync.
-- Additive only: one new table, one index, one unique constraint, two FKs.
-- This migration is NOT applied by this candidate; it is schema/SQL validated.
--
-- Generated with:
--   prisma migrate diff --from-schema-datamodel <base> --to-schema-datamodel prisma/schema.prisma --script

-- CreateTable
CREATE TABLE "faculty_grade_preferences" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "grade_levels" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_grade_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faculty_grade_preferences_school_id_idx" ON "faculty_grade_preferences"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_grade_preference_school_faculty" ON "faculty_grade_preferences"("school_id", "faculty_id");

-- AddForeignKey
ALTER TABLE "faculty_grade_preferences" ADD CONSTRAINT "faculty_grade_preferences_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_grade_preferences" ADD CONSTRAINT "faculty_grade_preferences_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
