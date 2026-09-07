-- Persisted department alias — canonical mapping from alias to department code
CREATE TABLE "department_aliases" (
    "id"          SERIAL PRIMARY KEY,
    "school_id"   INTEGER NOT NULL,
    "alias"       VARCHAR(64) NOT NULL,
    "department"  VARCHAR(32) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_dept_alias_school"
        FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_department_alias_school_alias"
        UNIQUE ("school_id", "alias")
);

-- Persisted department label — human-readable label for a department code
CREATE TABLE "department_labels" (
    "id"          SERIAL PRIMARY KEY,
    "school_id"   INTEGER NOT NULL,
    "code"        VARCHAR(32) NOT NULL,
    "label"       VARCHAR(64) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_dept_label_school"
        FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_department_label_school_code"
        UNIQUE ("school_id", "code")
);

-- Persisted subject-code-to-department prefix rule
CREATE TABLE "subject_owner_prefixes" (
    "id"          SERIAL PRIMARY KEY,
    "school_id"   INTEGER NOT NULL,
    "prefix"      VARCHAR(16) NOT NULL,
    "department"  VARCHAR(32) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_subject_owner_prefix_school"
        FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_subject_owner_prefix_school_prefix"
        UNIQUE ("school_id", "prefix")
);

-- Persisted program scope rule — which programs a subject is allowed for
CREATE TABLE "program_scope_rules" (
    "id"            SERIAL PRIMARY KEY,
    "school_id"     INTEGER NOT NULL,
    "subject_id"    INTEGER NOT NULL,
    "program_type"  "ProgramType" NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_program_scope_rule_school"
        FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_program_scope_rule_subject"
        FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_program_scope_rule"
        UNIQUE ("school_id", "subject_id", "program_type")
);

-- Persisted cross-department permission
CREATE TABLE "cross_department_permissions" (
    "id"          SERIAL PRIMARY KEY,
    "school_id"   INTEGER NOT NULL,
    "faculty_id"  INTEGER NOT NULL,
    "subject_id"  INTEGER NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_cross_dept_perm_school"
        FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_cross_dept_perm_faculty"
        FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_cross_dept_perm_subject"
        FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_cross_dept_permission"
        UNIQUE ("school_id", "faculty_id", "subject_id")
);
