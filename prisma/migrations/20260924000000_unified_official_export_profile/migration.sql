-- Add school-year-scoped official-export identity to the existing append-only
-- presentation revision. No migration is applied by this candidate.
ALTER TABLE "teacher_program_presentation_revisions"
    ADD COLUMN "official_school_name" VARCHAR(200),
    ADD COLUMN "header_line" VARCHAR(200),
    ADD COLUMN "region_line" VARCHAR(160),
    ADD COLUMN "division_line" VARCHAR(160),
    ADD COLUMN "district_line" VARCHAR(160);
