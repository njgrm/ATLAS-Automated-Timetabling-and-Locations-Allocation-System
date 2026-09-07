CREATE TABLE "policy_special_events" (
    "id" SERIAL PRIMARY KEY,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "event_type" VARCHAR(48) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "grade_group" VARCHAR(24),
    "program_type" VARCHAR(24),
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_special_events_school_id_fkey"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_policy_special_events_scope"
    ON "policy_special_events"("school_id", "school_year_id", "event_type", "grade_group", "program_type");

CREATE INDEX "idx_policy_special_events_scope"
    ON "policy_special_events"("school_id", "school_year_id");
