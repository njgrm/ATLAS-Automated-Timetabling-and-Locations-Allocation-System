ALTER TABLE "subject_section_ownerships"
ADD COLUMN "specialization_code" VARCHAR(64),
ADD COLUMN "specialization_label" VARCHAR(128);

UPDATE "subject_section_ownerships" AS sso
SET
  "specialization_code" = NULLIF(UPPER(REGEXP_REPLACE(BTRIM(fm."specialization"), '[^A-Za-z0-9]+', '_', 'g')), ''),
  "specialization_label" = NULLIF(BTRIM(fm."specialization"), '')
FROM "faculty_mirrors" AS fm,
     "subjects" AS sub
WHERE fm."id" = sso."faculty_id"
  AND sub."id" = sso."subject_id"
  AND sso."specialization_code" IS NULL
  AND sso."specialization_label" IS NULL
  AND NULLIF(BTRIM(fm."specialization"), '') IS NOT NULL
  AND (
    sub."code" IN ('SPA_SPEC', 'SPS_SPEC')
    OR sub."code" LIKE 'TLE_SPEC_%'
  );