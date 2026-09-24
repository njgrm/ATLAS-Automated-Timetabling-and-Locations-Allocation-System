-- TEACHER-AVAILABILITY-AUTHORITY-C01 (decisions D1/D2): term-scoped, reviewed,
-- versioned teacher-availability authority. This is the single generation source
-- for a teacher's UNAVAILABLE (HARD exclusion) and PREFERRED (ranked SOFT)
-- signals. Additive only: one new enum, two new tables, three indexes, one
-- unique constraint, three FKs. No existing table is altered, no legacy
-- `faculty_preferences`/`preference_time_slots` row is touched or dropped.
-- This migration is NOT applied by this candidate; it is schema/SQL validated.
--
-- Generated with:
--   prisma migrate diff --from-schema-datamodel <base> --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "faculty_availability_status" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'REJECTED');

-- CreateTable
CREATE TABLE "faculty_availabilities" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "term_index" INTEGER NOT NULL,
    "status" "faculty_availability_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_availability_slots" (
    "id" SERIAL NOT NULL,
    "availability_id" INTEGER NOT NULL,
    "day" "day_of_week" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "state" "time_slot_preference" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_faculty_availability_reviewed" ON "faculty_availabilities"("school_id", "school_year_id", "term_index", "status");

-- CreateIndex
CREATE INDEX "faculty_availabilities_faculty_id_idx" ON "faculty_availabilities"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_availability_scope" ON "faculty_availabilities"("school_id", "school_year_id", "faculty_id", "term_index");

-- CreateIndex
CREATE INDEX "faculty_availability_slots_availability_id_idx" ON "faculty_availability_slots"("availability_id");

-- AddForeignKey
ALTER TABLE "faculty_availabilities" ADD CONSTRAINT "faculty_availabilities_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_availabilities" ADD CONSTRAINT "faculty_availabilities_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_availability_slots" ADD CONSTRAINT "faculty_availability_slots_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "faculty_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
