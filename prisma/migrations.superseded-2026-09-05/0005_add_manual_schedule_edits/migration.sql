-- CreateEnum
CREATE TYPE "manual_edit_type" AS ENUM ('PLACE_UNASSIGNED', 'MOVE_ENTRY', 'CHANGE_ROOM', 'CHANGE_FACULTY', 'CHANGE_TIMESLOT', 'REVERT');

-- AlterTable
ALTER TABLE "generation_runs" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "manual_schedule_edits" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "edit_type" "manual_edit_type" NOT NULL,
    "before_payload" JSONB NOT NULL,
    "after_payload" JSONB NOT NULL,
    "validation_summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_schedule_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manual_schedule_edits_run_id_createdAt_idx" ON "manual_schedule_edits"("run_id", "createdAt");

-- CreateIndex
CREATE INDEX "manual_schedule_edits_school_id_school_year_id_idx" ON "manual_schedule_edits"("school_id", "school_year_id");

-- AddForeignKey
ALTER TABLE "manual_schedule_edits" ADD CONSTRAINT "manual_schedule_edits_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
