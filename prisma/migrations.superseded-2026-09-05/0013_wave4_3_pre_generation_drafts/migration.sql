CREATE TYPE "pre_generation_draft_status" AS ENUM ('DRAFT', 'LOCKED_FOR_RUN', 'ARCHIVED');

CREATE TYPE "pre_generation_draft_entry_kind" AS ENUM ('SECTION', 'COHORT');

ALTER TABLE "locked_sessions"
ADD COLUMN "entry_kind" "pre_generation_draft_entry_kind" NOT NULL DEFAULT 'SECTION',
ADD COLUMN "cohort_code" TEXT,
ADD COLUMN "status" "pre_generation_draft_status" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "locked_run_id" INTEGER,
ADD COLUMN "notes" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "locked_sessions"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "locked_sessions" DROP CONSTRAINT IF EXISTS "uq_locked_session";
DROP INDEX IF EXISTS "uq_locked_session";

CREATE UNIQUE INDEX "uq_locked_session"
ON "locked_sessions" ("school_id", "school_year_id", "entry_kind", "section_id", "subject_id", "cohort_code", "day", "start_time");

CREATE INDEX "locked_sessions_school_id_school_year_id_status_idx"
ON "locked_sessions" ("school_id", "school_year_id", "status");

CREATE INDEX "locked_sessions_locked_run_id_idx"
ON "locked_sessions" ("locked_run_id");

CREATE TABLE "locked_session_actions" (
  "id" SERIAL NOT NULL,
  "lock_id" INTEGER,
  "school_id" INTEGER NOT NULL,
  "school_year_id" INTEGER NOT NULL,
  "actor_id" INTEGER NOT NULL,
  "action_type" TEXT NOT NULL,
  "before_payload" JSONB,
  "after_payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "locked_session_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "locked_session_actions_lock_id_created_at_idx"
ON "locked_session_actions" ("lock_id", "createdAt");

CREATE INDEX "locked_session_actions_school_id_school_year_id_created_at_idx"
ON "locked_session_actions" ("school_id", "school_year_id", "createdAt");

ALTER TABLE "locked_session_actions"
ADD CONSTRAINT "locked_session_actions_lock_id_fkey"
FOREIGN KEY ("lock_id") REFERENCES "locked_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;