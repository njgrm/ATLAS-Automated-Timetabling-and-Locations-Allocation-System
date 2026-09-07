-- CreateEnum
CREATE TYPE "class_program_slot_kind" AS ENUM ('CLASS', 'BREAK', 'SPECIAL_EVENT', 'CONFLICT');

-- CreateTable
CREATE TABLE "class_program_slots" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "grade_level" INTEGER NOT NULL,
    "program_type" "program_type",
    "day_of_week" VARCHAR(16),
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "row_kind" "class_program_slot_kind" NOT NULL,
    "subject_family" VARCHAR(64),
    "subject_label" VARCHAR(128),
    "source_label" VARCHAR(64) NOT NULL DEFAULT 'TEMPLATE',
    "source_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_program_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_class_program_slot" ON "class_program_slots"("school_id", "school_year_id", "grade_level", "program_type", "day_of_week", "start_time", "row_kind");

-- CreateIndex
CREATE INDEX "class_program_slots_school_id_school_year_id_grade_level_program_type_idx" ON "class_program_slots"("school_id", "school_year_id", "grade_level", "program_type");

-- AddForeignKey
ALTER TABLE "class_program_slots" ADD CONSTRAINT "class_program_slots_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
