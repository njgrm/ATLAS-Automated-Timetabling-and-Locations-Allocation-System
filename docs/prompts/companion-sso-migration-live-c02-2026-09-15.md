# COMPANION-SSO-MIGRATION-LIVE-C02-2026-09-15 — prepared HIGH migration preview/apply packet

Status: **PREPARED — NOT APPROVED. The exact operator approval sentence in
section 9 has NOT been granted.** No part of this packet may be executed until
the operator returns that sentence verbatim (or an explicit superset).

Risk: **HIGH — schema migration against the shared/live ATLAS PostgreSQL
database.** Prepared 2026-09-15 (Asia/Manila) by the COMPANION-SSO-LIVE-PREP-C02
executor (`REVIEW_REQUIRED`); independent pre-action review and explicit
operator approval are required before execution.

## 1. Objective

Apply exactly one tracked migration, `0002_companion_sso_code`, to the verified
live ATLAS database so the approved COMPANION-SSO-C01 source can persist
one-time reverse SSO codes (`companion_sso_codes`). This packet authorizes that
single schema change and its verification only. It does **not** authorize
configuration, secret creation, deployment, release install, process restart,
login, SSO code issue/exchange/consume, session creation, generation,
publication, Teaching Load or term-cache actions, or any companion mutation.

## 2. Scope and authority

- Owner: ATLAS.
- Target: exactly one database, the configured ATLAS database whose sanitized
  name is `atlas_recovery_clean_rebuild_20260905` (local PostgreSQL 18.1,
  `:5432`, user `atlas_user`, non-superuser, CREATEDB). Record the resolved
  database name at preflight; it MUST equal this value, otherwise STOP.
- Migration: exactly `prisma/migrations/0002_companion_sso_code/migration.sql`.
- No other migration may be applied; `0000_clean_baseline` and
  `0001_term_subject_authority` are already applied and finished.
- One bounded database action; a migration preview is not migration approval.

## 3. Prepared-time live snapshot (read-only, 2026-09-15 ~04:05Z / ~12:05 +08)

Every value is a preparation-time observation and a revalidation input, not an
execution assumption. Re-probe each value at execution preflight; STOP and
report if the live identity differs.

- `_prisma_migrations` rows: **2** (`0000_clean_baseline` finished,
  `0001_term_subject_authority` finished, neither rolled back).
- `0002_companion_sso_code`: **ABSENT** (not applied).
- `public.companion_sso_codes`: **ABSENT** (`to_regclass` IS NULL).
- Baseline signatures: `schools`=2, `atlas_auth_accounts`=44 (roles
  `faculty`=42, `officer`=2), `audit_logs`=242,
  `enrollpro_school_year_mirrors`=2, `faculty_mirrors`=42.
- Durable env file: `D:\ATLAS-runtime-config\atlas-server.env` (13 keys).
- Guarded-path defaults: backup root `D:\ATLAS-database-recovery\backups`,
  fresh-manifest max age 24 h, `ATLAS_PG_BIN_DIR` default `D:\PostgreSQL\18\bin`.
- Canonical Prisma schema: `prisma/schema.prisma` (repository root). The guarded
  wrapper always forwards `--schema ../prisma/schema.prisma` from `atlas-server/`
  (`atlas-server/src/scripts/atlas-migrate.ts:40,77-79`).
- Shared runtime (unrelated to this migration, listed so it is explicitly
  untouched): release `3d916b26`, productPin `d44f29e0`, listeners 5001/5174
  owned by the resident supervisor. This packet does not touch the runtime.

## 4. Exact migration content (bind before apply)

| Item | Value |
| --- | --- |
| Path | `prisma/migrations/0002_companion_sso_code/migration.sql` |
| Git blob | `8d61bd591e564b9a686028f64dc6fc7d8e898635` |
| Git blob bytes | 1046 |
| **LF-normalized SHA-256 (authoritative fingerprint)** | `c2502e3070a98e6a6ddf4a1568cf2b3368a5cc72db2983cd02d0311012e43baf` |
| Working-tree checkout SHA-256 | `cdbc387221eaba88d40800e45bfd36fdcb00540c2b800b2e54a3c80a5bbfd05b` (CRLF checkout artifact) |

Preflight MUST recompute the LF-normalized SHA-256 of
`origin/main:prisma/migrations/0002_companion_sso_code/migration.sql` and refuse
to proceed on any mismatch. Expected DDL, verbatim:

```sql
-- CreateTable
CREATE TABLE "companion_sso_codes" (
    "id" SERIAL NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "user_id" INTEGER,
    "school_id" INTEGER,
    "school_year_id" INTEGER,
    "audience" VARCHAR(32) NOT NULL DEFAULT 'enrollpro',
    "redirect_uri" VARCHAR(512) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_sso_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companion_sso_codes_code_hash_key" ON "companion_sso_codes"("code_hash");

-- CreateIndex
CREATE INDEX "companion_sso_codes_code_hash_consumed_at_idx" ON "companion_sso_codes"("code_hash", "consumed_at");

-- CreateIndex
CREATE INDEX "companion_sso_codes_expires_at_idx" ON "companion_sso_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "companion_sso_codes" ADD CONSTRAINT "companion_sso_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "atlas_auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

No other object may be created, altered, or dropped. No data row is written.

## 5. Preflight (all mandatory; STOP on any failure)

1. Record resolved host/database/user (sanitized), environment classification
   `LIVE`, `schools` count, and `_prisma_migrations` count without exposing
   secrets. Confirm the database name is `atlas_recovery_clean_rebuild_20260905`.
2. Confirm `0002_companion_sso_code` is ABSENT and both prior migrations are
   finished and not rolled back.
3. Confirm `git -C <worktree> rev-parse HEAD` is the accepted runbook base and
   that `prisma/schema.prisma` contains `model CompanionSsoCode` mapped to
   `companion_sso_codes`.
4. Recompute the §4 fingerprint and verify it matches.
5. Create a **fresh** backup of the target database and a valid manifest:
   from `atlas-server/`, `npm run backup` (default backup root
   `D:\ATLAS-database-recovery\backups`), then
   `npm run backup:retention` and `npx tsx src/scripts/atlas-backup.ts validate --manifest <path>`.
   Record the absolute archive path, byte size, SHA-256, `restoreListEntries`,
   and manifest file name; never print secret values.
   **Requirement:** the selected manifest must be ≤24 h old for the exact target
   database when `npm run migrate:guarded` runs.
6. Record the exact DDL the migration will emit (§4) and the before signatures
   (§3) as a pre-apply evidence block.
7. Confirm no other migration is pending and no `--schema` argument will be
   forwarded to the guarded wrapper.

If any preflight step fails, STOP and report; do not run the guarded wrapper.

## 6. Apply command (the only authorized apply)

From `atlas-server/` with `DATABASE_URL` pointing at the verified live database:

```
npm run migrate:guarded
```

This runs `tsx src/scripts/atlas-migrate.ts`, which:
1. rejects a forwarded `--schema` (exit 1, `SCHEMA_FLAG_CONFLICT`);
2. loads the backup config and sanitizes the target from `DATABASE_URL`;
3. selects and revalidates a fresh (≤24 h) manifest for that exact target with a
   live `pg_restore --list`;
4. logs `MIGRATE_GATE_OK target=… manifest=…`;
5. spawns exactly `npx prisma migrate deploy --schema ../prisma/schema.prisma`.

Forbidden: `prisma db push`, `prisma migrate reset`, `prisma migrate dev`,
`prisma db push --force-reset`, any manual SQL that inserts into
`_prisma_migrations`, re-running `0000`/`0001`, forwarding `--schema`, and any
schema command against any database other than the verified target.

## 7. Post-apply verification (all mandatory)

1. `npx prisma migrate status --schema prisma/schema.prisma` from the repo root
   reports the schema is up to date; `_prisma_migrations` gain exactly one
   finished, not-rolled-back row `0002_companion_sso_code`.
2. `public.companion_sso_codes` exists with exactly the §4 columns, nullability,
   defaults, indexes (`_pkey`, `_code_hash_key` unique,
   `_code_hash_consumed_at_idx`, `_expires_at_idx`), and the
   `_user_id_fkey` FK (`ON UPDATE CASCADE ON DELETE CASCADE`).
3. Table row count is 0 immediately after apply (no data row written).
4. Non-target signatures unchanged versus §3: `schools`=2,
   `atlas_auth_accounts`=44, `audit_logs`=242,
   `enrollpro_school_year_mirrors`=2, `faculty_mirrors`=42.
5. Replay/idempotence: a second `npm run migrate:guarded` (or
   `prisma migrate deploy`) is a no-op ("No pending migrations to apply.") and
   writes nothing.
6. Record the exact command transcript (bounded), the guard's
   `MIGRATE_GATE_OK` line, and the resulting `_prisma_migrations` row.

## 8. Rollback (per stage)

Migration `0002` ships **no down script**; the rehearsed rollback (validated on
a disposable database in COMPANION-SSO-LIVE-PREP-C02) is:

1. `DROP TABLE IF EXISTS companion_sso_codes;`
2. `DELETE FROM _prisma_migrations WHERE migration_name = '0002_companion_sso_code';`
3. Verify the table is absent and `_prisma_migrations` is back to 2 rows.
4. If a clean re-apply is required, re-run §6 and re-verify §7.

Rollback must be executed only on the same verified target, only for a failed
acceptance or a discovered defect, and must be recorded with the exact SQL run,
the before/after counts, and the operator approval that authorized it. A
data-bearing table (row count > 0) must be captured (sanity-checked `pg_dump` or
equivalent evidence) before any `DROP`. Restore-from-backup remains the last
resort and requires the §5 backup archive.

## 9. Exact proposed HIGH approval sentence (NOT GRANTED)

> APPROVE COMPANION-SSO-MIGRATION-LIVE-C02-2026-09-15: take a fresh verified
> backup of the live ATLAS database `atlas_recovery_clean_rebuild_20260905` and
> apply exactly the tracked migration
> `prisma/migrations/0002_companion_sso_code/migration.sql`
> (LF-normalized SHA-256
> `c2502e3070a98e6a6ddf4a1568cf2b3368a5cc72db2983cd02d0311012e43baf`) to that
> database using the canonical guarded command `npm run migrate:guarded` from
> `atlas-server/`; verify the expected DDL (`companion_sso_codes` table, its
> columns/defaults/indexes, and the `user_id → atlas_auth_accounts(id)`
> CASCADE FK), a zero row count, an unchanged non-target signature (schools=2,
> atlas_auth_accounts=44, audit_logs=242, enrollpro_school_year_mirrors=2,
> faculty_mirrors=42), migration-status replay as a no-op, and record the
> `MIGRATE_GATE_OK` receipt; and on any mandatory failure roll back by dropping
> `companion_sso_codes` and deleting its `_prisma_migrations` row (or restoring
> the backup). Excluded: every other migration, all configuration and secret
> changes, deployment/release install, process or listener changes, login, SSO
> code issue/exchange/consume, session creation, companion repositories,
> databases, generation, publication, term-cache, and Teaching Load. Expected
> database mutations: exactly one new applied-migration row and the
> `companion_sso_codes` DDL; zero data rows.

## 10. Execution record required

Return: preflight re-probe results and resolved (sanitized) target identity;
the recomputed §4 fingerprint; the backup archive path + size + SHA-256 +
`restoreListEntries` + manifest name and the `npm run backup` result; the exact
`npm run migrate:guarded` invocation and its `MIGRATE_GATE_OK` line; the
`_prisma_migrations` before/after rows; the post-apply schema proof (columns,
indexes, FK); the row-count and non-target signature deltas; the replay no-op
result; the rollback record if used; an explicit statement that no excluded
action occurred; and the final live identity of the target database.
