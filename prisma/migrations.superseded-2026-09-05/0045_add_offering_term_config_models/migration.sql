-- Offering classification vocabulary enum
CREATE TYPE "offering_classification" AS ENUM ('CORE', 'SPECIALIZATION', 'EXPLORATORY', 'OTHER');

-- Term mode enum
CREATE TYPE "term_mode" AS ENUM ('ALL', 'ROTATING_FAMILY_MEMBER', 'EMPTY');

-- School-year term configuration
CREATE TABLE "school_year_term_configs" (
    "id"              SERIAL PRIMARY KEY,
    "school_id"       INTEGER NOT NULL,
    "school_year_id"  INTEGER NOT NULL,
    "term_count"      INTEGER NOT NULL,
    "term_identities" JSONB NOT NULL,
    "is_active"       BOOLEAN NOT NULL DEFAULT true,
    "created_by"      INTEGER,
    "updated_by"      INTEGER,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_term_config_school"
        FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
    CONSTRAINT "ck_term_config_count" CHECK ("term_count" >= 1),
    CONSTRAINT "uq_term_config_school_year"
        UNIQUE ("school_id", "school_year_id")
);

-- The offering row
CREATE TABLE "school_year_offerings" (
    "id"                 SERIAL PRIMARY KEY,
    "school_id"          INTEGER NOT NULL,
    "school_year_id"     INTEGER NOT NULL,
    "term_config_id"     INTEGER NOT NULL,
    "subject_id"         INTEGER,
    "grade_level"        INTEGER NOT NULL,
    "program_type"       "ProgramType" NOT NULL,
    "section_mirror_id"  INTEGER,
    "cohort_id"          INTEGER,
    "classification"     "offering_classification" NOT NULL,
    "weekly_minutes"     INTEGER NOT NULL DEFAULT 0,
    "rotation_family"    VARCHAR(64),
    "rotation_order"     INTEGER,
    "term_mode"          "term_mode" NOT NULL,
    "is_active"          BOOLEAN NOT NULL DEFAULT true,
    "retired_at"         TIMESTAMP(3),
    "retired_by"         INTEGER,
    "version"            INTEGER NOT NULL DEFAULT 1,
    "created_by"         INTEGER,
    "updated_by"         INTEGER,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_offering_school"
        FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_offering_subject"
        FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE RESTRICT,
    CONSTRAINT "fk_offering_term_config"
        FOREIGN KEY ("term_config_id")
        REFERENCES "school_year_term_configs" ("id") ON DELETE RESTRICT,
    CONSTRAINT "ck_offering_grade" CHECK ("grade_level" IN (7, 8, 9, 10)),
    CONSTRAINT "ck_offering_version" CHECK ("version" >= 1),
    CONSTRAINT "uq_offering_scope"
        UNIQUE ("school_id", "school_year_id", "subject_id", "grade_level", "program_type",
                COALESCE("section_mirror_id", 0), COALESCE("cohort_id", 0), COALESCE("rotation_family", ''))
);

-- Relational term applicability
CREATE TABLE "offering_term_assignments" (
    "id"              SERIAL PRIMARY KEY,
    "offering_id"     INTEGER NOT NULL,
    "term_identity"   VARCHAR(64) NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_offering_term_assignment_offering"
        FOREIGN KEY ("offering_id") REFERENCES "school_year_offerings" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_offering_term_assignment"
        UNIQUE ("offering_id", "term_identity")
);

-- Read-path indexes
CREATE INDEX "idx_offering_demand"
    ON "school_year_offerings" ("school_id", "school_year_id", "is_active", "grade_level", "program_type");
CREATE INDEX "idx_offering_subject"
    ON "school_year_offerings" ("subject_id");
CREATE INDEX "idx_offering_section"
    ON "school_year_offerings" ("school_id", "school_year_id", "section_mirror_id");
CREATE INDEX "idx_offering_term_assignments"
    ON "offering_term_assignments" ("term_identity");
