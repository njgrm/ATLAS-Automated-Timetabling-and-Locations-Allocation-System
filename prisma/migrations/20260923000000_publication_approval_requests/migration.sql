CREATE TYPE publication_approval_status AS ENUM ('PENDING', 'APPROVED');

CREATE UNIQUE INDEX generation_runs_id_school_scope_key
    ON generation_runs(id, school_id, school_year_id);

CREATE TABLE publication_approval_requests (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    school_year_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    run_version INTEGER NOT NULL,
    snapshot_hash CHAR(64) NOT NULL,
    source_revision_id INTEGER,
    requester_id INTEGER NOT NULL,
    requester_acknowledged_soft_violations BOOLEAN NOT NULL DEFAULT FALSE,
    approver_id INTEGER,
    status publication_approval_status NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP(3),
    published_revision_id INTEGER,
    CONSTRAINT publication_approval_requests_run_scope_fkey
        FOREIGN KEY (run_id, school_id, school_year_id)
        REFERENCES generation_runs(id, school_id, school_year_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT publication_approval_requests_school_id_fkey
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT publication_approval_requests_requester_id_fkey
        FOREIGN KEY (requester_id) REFERENCES atlas_auth_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT publication_approval_requests_approver_id_fkey
        FOREIGN KEY (approver_id) REFERENCES atlas_auth_accounts(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT publication_approval_requests_source_revision_id_fkey
        FOREIGN KEY (source_revision_id) REFERENCES published_schedule_revisions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT publication_approval_requests_published_revision_id_fkey
        FOREIGN KEY (published_revision_id) REFERENCES published_schedule_revisions(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX publication_approval_requests_scope_run_version_key
    ON publication_approval_requests(school_id, school_year_id, run_id, run_version);

CREATE INDEX publication_approval_requests_school_id_school_year_id_status_requested_at_idx
    ON publication_approval_requests(school_id, school_year_id, status, requested_at);
