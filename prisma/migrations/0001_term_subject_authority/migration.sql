-- TERM-SUBJ-C01: Subject demand disposition and year-bound EnrollPro term cache.
CREATE TYPE "subject_scheduling_disposition" AS ENUM ('SCHEDULED_TEACHING', 'REFERENCE_ONLY');

ALTER TABLE "enrollpro_school_year_mirrors"
  ADD COLUMN "term_contract_cache" JSONB,
  ADD COLUMN "term_contract_cached_at" TIMESTAMP(3);

ALTER TABLE "subjects"
  ADD COLUMN "scheduling_disposition" "subject_scheduling_disposition"
  NOT NULL DEFAULT 'SCHEDULED_TEACHING';

-- Existing catalog rows remain scheduled teaching except the explicit
-- Homeroom Guidance identity, which is reference-only scheduling metadata.
UPDATE "subjects"
SET "scheduling_disposition" = 'REFERENCE_ONLY'
WHERE UPPER(BTRIM("code")) = 'HG';

-- Rebuild/rollback path for a disposable target only:
-- ALTER TABLE "subjects" DROP COLUMN "scheduling_disposition";
-- ALTER TABLE "enrollpro_school_year_mirrors"
--   DROP COLUMN "term_contract_cached_at", DROP COLUMN "term_contract_cache";
-- DROP TYPE "subject_scheduling_disposition";
