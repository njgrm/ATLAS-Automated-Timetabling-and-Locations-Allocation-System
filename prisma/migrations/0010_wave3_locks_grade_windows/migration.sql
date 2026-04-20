-- Wave 3: Pre-generation locked sessions + grade shift windows

-- LockedSession table
CREATE TABLE IF NOT EXISTS "locked_sessions" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "faculty_id" INTEGER,
    "room_id" INTEGER,
    "day" "day_of_week" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locked_sessions_pkey" PRIMARY KEY ("id")
);

-- GradeShiftWindow table
CREATE TABLE IF NOT EXISTS "grade_shift_windows" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "grade_level" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_shift_windows_pkey" PRIMARY KEY ("id")
);

-- Indexes & unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "uq_locked_session" ON "locked_sessions"("school_id", "school_year_id", "section_id", "subject_id", "day", "start_time");
CREATE INDEX IF NOT EXISTS "locked_sessions_school_id_school_year_id_idx" ON "locked_sessions"("school_id", "school_year_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_grade_shift_window" ON "grade_shift_windows"("school_id", "school_year_id", "grade_level");
CREATE INDEX IF NOT EXISTS "grade_shift_windows_school_id_school_year_id_idx" ON "grade_shift_windows"("school_id", "school_year_id");
