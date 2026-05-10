-- Normalize the Values Education subject code to the current ESP code.
BEGIN;

UPDATE "subjects" AS src
SET code = 'ESP',
        name = 'Edukasyon sa Pagpapakatao'
WHERE src.code = 'VE'
    AND NOT EXISTS (
        SELECT 1
        FROM "subjects" AS existing
        WHERE existing."school_id" = src."school_id"
            AND existing.code = 'ESP'
    );

WITH source_subjects AS (
    SELECT id AS source_id, "school_id"
    FROM "subjects"
    WHERE code = 'VE'
),
target_subjects AS (
    SELECT id AS target_id, "school_id"
    FROM "subjects"
    WHERE code = 'ESP'
),
merged_subjects AS (
    SELECT source_subjects.source_id, target_subjects.target_id, source_subjects."school_id"
    FROM source_subjects
    INNER JOIN target_subjects
        ON target_subjects."school_id" = source_subjects."school_id"
)
UPDATE "faculty_subjects" AS fs
SET "subject_id" = merged_subjects.target_id
FROM merged_subjects
WHERE fs."subject_id" = merged_subjects.source_id
    AND fs."school_id" = merged_subjects."school_id";

WITH source_subjects AS (
    SELECT id AS source_id, "school_id"
    FROM "subjects"
    WHERE code = 'VE'
),
target_subjects AS (
    SELECT id AS target_id, "school_id"
    FROM "subjects"
    WHERE code = 'ESP'
),
merged_subjects AS (
    SELECT source_subjects.source_id, target_subjects.target_id, source_subjects."school_id"
    FROM source_subjects
    INNER JOIN target_subjects
        ON target_subjects."school_id" = source_subjects."school_id"
)
UPDATE "locked_sessions" AS ls
SET "subject_id" = merged_subjects.target_id
FROM merged_subjects
WHERE ls."subject_id" = merged_subjects.source_id
    AND ls."school_id" = merged_subjects."school_id";

DELETE FROM "subjects" AS src
USING "subjects" AS target
WHERE src.code = 'VE'
    AND target.code = 'ESP'
    AND src."school_id" = target."school_id";

COMMIT;