CREATE TABLE "enrollpro_school_year_mirrors" (
    "id" SERIAL PRIMARY KEY,
    "school_id" INTEGER NOT NULL,
    "enrollpro_school_year_id" INTEGER NOT NULL,
    "year_label" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "source_endpoint" VARCHAR(200) NOT NULL DEFAULT '/api/integration/v1/school-year',
    "faculty_count" INTEGER NOT NULL DEFAULT 0,
    "section_count" INTEGER NOT NULL DEFAULT 0,
    "sync_status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "last_failure_summary" VARCHAR(500),
    "last_sync_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enrollpro_school_year_mirrors_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_enrollpro_school_year_mirror"
    ON "enrollpro_school_year_mirrors"("school_id", "enrollpro_school_year_id");

CREATE INDEX "idx_enrollpro_school_year_mirror_active"
    ON "enrollpro_school_year_mirrors"("school_id", "is_active");
