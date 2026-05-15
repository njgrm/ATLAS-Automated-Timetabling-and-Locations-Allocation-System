-- Phase 1a-4: Add termIndex support to draft-affecting records.
ALTER TABLE "locked_sessions"
  ADD COLUMN "term_index" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "faculty_room_preferences"
  ADD COLUMN "term_index" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "locked_sessions"
  ADD CONSTRAINT "locked_sessions_term_index_chk" CHECK ("term_index" IN (1, 2, 3));

ALTER TABLE "faculty_room_preferences"
  ADD CONSTRAINT "faculty_room_preferences_term_index_chk" CHECK ("term_index" IN (1, 2, 3));

CREATE INDEX "locked_sessions_school_year_term_index_idx"
  ON "locked_sessions"("school_id", "school_year_id", "term_index");

CREATE INDEX "faculty_room_preferences_school_year_term_index_idx"
  ON "faculty_room_preferences"("school_id", "school_year_id", "term_index");
