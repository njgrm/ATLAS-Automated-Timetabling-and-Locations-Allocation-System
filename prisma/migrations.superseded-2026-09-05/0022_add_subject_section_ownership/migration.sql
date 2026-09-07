-- Pass 4A: Introduce normalized subject_section_ownerships table.
-- Each row represents exactly one owner (faculty) for a (schoolId, subjectId, sectionId) tuple.
-- The unique index uq_subject_section_owner is the DB-level hard guardrail.
-- Cascade-deletes when the parent faculty_subjects row is removed.
-- Backfill from existing faculty_subjects.section_ids arrays via the separate
-- backfill-subject-section-ownership.ts script after applying this migration.

-- CreateTable
CREATE TABLE "subject_section_ownerships" (
    "id"                 SERIAL          NOT NULL,
    "school_id"          INTEGER         NOT NULL,
    "faculty_subject_id" INTEGER         NOT NULL,
    "faculty_id"         INTEGER         NOT NULL,
    "subject_id"         INTEGER         NOT NULL,
    "section_id"         INTEGER         NOT NULL,
    "assigned_at"        TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_section_ownerships_pkey" PRIMARY KEY ("id")
);

-- Unique index: one owner per school+subject+section (the hard DB guardrail)
CREATE UNIQUE INDEX "uq_subject_section_owner"
    ON "subject_section_ownerships"("school_id", "subject_id", "section_id");

-- Supporting indexes
CREATE INDEX "subject_section_ownerships_faculty_subject_id_idx"
    ON "subject_section_ownerships"("faculty_subject_id");

CREATE INDEX "subject_section_ownerships_school_id_subject_id_idx"
    ON "subject_section_ownerships"("school_id", "subject_id");

CREATE INDEX "subject_section_ownerships_faculty_id_idx"
    ON "subject_section_ownerships"("faculty_id");

-- FK to faculty_subjects (CASCADE keeps the table self-cleaning on assignment deletes)
ALTER TABLE "subject_section_ownerships"
    ADD CONSTRAINT "subject_section_ownerships_faculty_subject_id_fkey"
    FOREIGN KEY ("faculty_subject_id")
    REFERENCES "faculty_subjects"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
