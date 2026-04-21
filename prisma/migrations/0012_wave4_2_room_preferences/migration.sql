CREATE TYPE "room_preference_status" AS ENUM ('DRAFT', 'SUBMITTED');

CREATE TYPE "room_preference_decision_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "faculty_room_preferences" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "run_id" INTEGER NOT NULL,
    "entry_id" TEXT NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "current_room_id" INTEGER NOT NULL,
    "requested_room_id" INTEGER NOT NULL,
    "day" "day_of_week" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "rationale" TEXT,
    "status" "room_preference_status" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewer_id" INTEGER,
    "decision_status" "room_preference_decision_status" NOT NULL DEFAULT 'PENDING',
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_room_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_room_preference_run_entry" ON "faculty_room_preferences"("run_id", "entry_id");
CREATE INDEX "faculty_room_preferences_school_id_school_year_id_status_idx" ON "faculty_room_preferences"("school_id", "school_year_id", "status");
CREATE INDEX "faculty_room_preferences_school_id_school_year_id_decision_status_idx" ON "faculty_room_preferences"("school_id", "school_year_id", "decision_status");
CREATE INDEX "faculty_room_preferences_run_id_faculty_id_idx" ON "faculty_room_preferences"("run_id", "faculty_id");
CREATE INDEX "faculty_room_preferences_requested_room_id_day_start_time_idx" ON "faculty_room_preferences"("requested_room_id", "day", "start_time");

ALTER TABLE "faculty_room_preferences"
    ADD CONSTRAINT "faculty_room_preferences_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "faculty_room_preferences"
    ADD CONSTRAINT "faculty_room_preferences_faculty_id_fkey"
    FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "faculty_room_preferences"
    ADD CONSTRAINT "faculty_room_preferences_requested_room_id_fkey"
    FOREIGN KEY ("requested_room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;