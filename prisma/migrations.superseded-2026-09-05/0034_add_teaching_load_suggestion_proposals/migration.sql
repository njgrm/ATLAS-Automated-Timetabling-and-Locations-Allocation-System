CREATE TYPE "teaching_load_suggestion_status" AS ENUM (
    'PENDING',
    'APPLIED',
    'CANCELLED',
    'SUPERSEDED',
    'EXPIRED'
);

CREATE TABLE "teaching_load_suggestion_proposals" (
    "id" SERIAL PRIMARY KEY,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "coverage_mode" VARCHAR(48) NOT NULL,
    "status" "teaching_load_suggestion_status" NOT NULL DEFAULT 'PENDING',
    "preview_payload" JSONB NOT NULL,
    "refreshed_preview_payload" JSONB,
    "apply_payload" JSONB,
    "section_source" VARCHAR(48),
    "section_fallback_reason" VARCHAR(500),
    "suggested_assignment_count" INTEGER NOT NULL DEFAULT 0,
    "unresolved_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "applied_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    CONSTRAINT "teaching_load_suggestion_proposals_school_id_fkey"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_teaching_load_suggestion_scope_status"
    ON "teaching_load_suggestion_proposals"("school_id", "school_year_id", "status");

CREATE INDEX "idx_teaching_load_suggestion_created_by"
    ON "teaching_load_suggestion_proposals"("created_by");
