-- BENEFICIARY-EXPORT-PARITY-C05R1: append-only, school/year-scoped editable
-- teacher-program presentation profile (signatory names/titles + footer).
-- Source only. This migration is NOT applied to the shared/live database; it is
-- proven on a disposable PostgreSQL database by the export-presentation suite.

-- CreateTable
CREATE TABLE "teacher_program_presentation_revisions" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "school_head_name" VARCHAR(120),
    "school_head_title" VARCHAR(120),
    "psds_name" VARCHAR(120),
    "psds_title" VARCHAR(120),
    "cid_chief_name" VARCHAR(120),
    "cid_chief_title" VARCHAR(120),
    "asds_name" VARCHAR(120),
    "asds_title" VARCHAR(120),
    "footer_text" VARCHAR(200),
    "created_by" INTEGER NOT NULL,
    "audit_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_program_presentation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_program_presentation_revision" ON "teacher_program_presentation_revisions"("school_id", "school_year_id", "revision");

-- CreateIndex
CREATE INDEX "idx_teacher_program_presentation_scope" ON "teacher_program_presentation_revisions"("school_id", "school_year_id", "created_at");

-- AddForeignKey
ALTER TABLE "teacher_program_presentation_revisions" ADD CONSTRAINT "teacher_program_presentation_revisions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
