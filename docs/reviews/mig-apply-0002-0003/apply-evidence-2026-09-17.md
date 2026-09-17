# MIG-APPLY-0002-0003 — guarded apply evidence (2026-09-17)

Executor evidence document for the approved live schema apply of
`0002_companion_sso_code` and `0003_teacher_program_presentation` to
`atlas_recovery_clean_rebuild_20260905`. This is the only path this executor
created; no register, receipt, packet, migration, product, runtime, task, env,
or companion file was edited.

| Item | Value |
| --- | --- |
| Stream | `MIG-APPLY-0002-0003` (HIGH; live shared schema apply) |
| Accepted base (dispatch `HEAD`) | `6058d3ab3bb4050ede27ec8c52c56f84029767e7` |
| Branch | `chore/mig-apply-0002-0003` |
| Worktree | `E:/ATLAS-worktrees/mig-apply-0002-0003` |
| Governing packet | `docs/prompts/mig-apply-0002-0003-2026-09-17.md` (blob `107bfbbac1f1b1f5793188a02b846b680f5c971f`, 30377 bytes, LF-SHA-256 `d7e0bc1db3bccd712d4ad2ff72fa0b938caf38d0323c0a13b0877bb07638abf4`) |
| Directive | `origin/main:AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`, LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3` — verified this turn |
| Approval | Grant recorded in the machine register at revision 290 (`WF-C10` `record-approval`): `approval.granted = true`, `operatorIdentity = operator:njgrm`, `approvedAt = 2026-09-17T10:58:33.064Z` |
| Database / target | `atlas_recovery_clean_rebuild_20260905` on `localhost:5432` (LIVE_SHARED) |
| Measured window (Asia/Manila) | L1 `2026-09-17 19:00:47.942+08` → L8 `2026-09-17 19:02:10.885+08` |

## 1. Post-apply result

Both migrations applied through the canonical guarded wrapper only. The apply
was **purely additive**: two new tables, their indexes, and their foreign keys
were created; no pre-existing object, row, enum, or registry entry was altered
or removed.

## 2. Acceptance matrix (12 mandatory rows)

Predeclared plan: `MANDATORY_SOURCE=4`, `MANDATORY_LIVE=8`, `DEFERRED_EXTERNAL=0`.
Tally: **SOURCE 4 passed / 0 failed / 0 blocked / 0 unperformed**;
**LIVE 8 passed / 0 failed / 0 blocked / 0 unperformed**.

| # | Class | Verdict | Observed evidence |
| --- | --- | --- | --- |
| S1 | SOURCE | **PASS** | The governing packet at the accepted base pins target identity, expected applied count, school count, both migration fingerprints, the literal SQL, the exact command, the bounded rollback, and the verbatim §9 approval sentence. Blob `107bfbba`, 30377 bytes, LF-SHA-256 `d7e0bc1d…` verified. |
| S2 | SOURCE | **PASS** | Both migration files match the pinned blobs and LF-normalized SHA-256 (`0002`: blob 1046 B / `c2502e3070a98e6a6ddf4a1568cf2b3368a5cc72db2983cd02d0311012e43baf`; `0003`: blob 1585 B / `b3270f02f16486f7b4e25538f80d675e42ba7cd6a9b704aebd3fff2593a764ee`). The executed command was `npm run migrate:guarded` with **no forwarded arguments**; the captured line is `MIGRATE_GATE_OK`. No `db push`, `migrate reset`, direct `migrate deploy`, `--force-reset`, or manual `_prisma_migrations` statement was run. |
| S3 | SOURCE | **PASS** | The candidate range is docs-only (this one evidence file). No product, runtime, env, task, or companion path appears. `git diff --check` clean; `git status --porcelain=v2` empty at handoff. |
| S4 | SOURCE | **PASS** | Rollback is bounded to dropping the two new tables or restoring the §6 backup; `_prisma_migrations` is never hand-edited. The `0003` header note is cited and superseded below (§6). |
| L1 | LIVE | **PASS** | Read-only re-measure at `2026-09-17 19:00:47.942+08` matches §3 P1–P12 exactly, with no divergence (table below). |
| L2 | LIVE | **PASS** | Fresh logical backup `atlas-backup-atlas_recovery_clean_rebuild_20260905-20260917-110058.dump` (270517 B, sha256 `a989f3c9…`, 464 restore-list entries); `VALIDATE_OK`; the wrapper selected exactly that manifest (`MIGRATE_GATE_OK manifest=atlas-backup-…-20260917-110058.dump.manifest.json`, `createdAt 2026-09-17T11:00:58.701Z` — after the L1 re-measure). |
| L3 | LIVE | **PASS** | `_prisma_migrations`: 4 rows, 4 applied, 0 unfinished, 0 rolled back. `0002_companion_sso_code` and `0003_teacher_program_presentation` both `finished=t`, `not_rolled_back=t`. |
| L4 | LIVE | **PASS** | `companion_sso_codes` present (`t`); indexes `companion_sso_codes_pkey`, `companion_sso_codes_code_hash_key` (UNIQUE), `companion_sso_codes_code_hash_consumed_at_idx`, `companion_sso_codes_expires_at_idx`; FK `companion_sso_codes_user_id_fkey → atlas_auth_accounts`; all 10 columns match the literal SQL. |
| L5 | LIVE | **PASS** | `teacher_program_presentation_revisions` present (`t`); indexes `teacher_program_presentation_revisions_pkey`, `uq_teacher_program_presentation_revision` (UNIQUE), `idx_teacher_program_presentation_scope`; FK `teacher_program_presentation_revisions_school_id_fkey → schools`; all 16 columns match the literal SQL. |
| L6 | LIVE | **PASS** | Both new tables empty: `companion_sso_codes = 0`, `teacher_program_presentation_revisions = 0`. |
| L7 | LIVE | **PASS** | Protected domains delta 0 for every domain vs L1: subjects 22, section_mirrors 40, faculty_mirrors 42, teaching_load_cycles 2, generation_runs 1, published_schedule_revisions 0, audit_logs 248. (Per the carried pre-action finding F2, `audit_logs` is delta-compared: L1 248 → L7 248.) |
| L8 | LIVE | **PASS** | After the apply: `http://localhost:5001/api/v1/health/ready` → 200 `{"status":"ready","service":"atlas","checks":{"database":"ok"}}`; `https://njgrm.buru-degree.ts.net/api/v1/health/ready` → 200 with the same body; plain `/api/v1/health` → 200 on both origins. The runtime was not restarted. |

## 3. Pre-state re-measure (L1) and post-state (L3–L7)

L1 measured `2026-09-17 19:00:47.942056+08` against
`atlas_recovery_clean_rebuild_20260905` (server `::1:5432`, role `atlas_user`,
PostgreSQL 18.1). Post-state measured `2026-09-17 19:02:00.81109+08`.

| # | Fact | §3 expected | L1 observed | Post observed | Result |
| --- | --- | --- | --- | --- | --- |
| P1 | applied migrations | 2 | 2 (`0000_clean_baseline`, `0001_term_subject_authority`); unfinished 0, rolled back 0 | 4 applied, unfinished 0, rolled back 0 (adds `0002`, `0003`) | PASS |
| P2 | `public.companion_sso_codes` | ABSENT | absent (`f`) | present (`t`) | PASS |
| P3 | `public.teacher_program_presentation_revisions` | ABSENT | absent (`f`) | present (`t`) | PASS |
| P4 | `schools` | present; 2 | 2; id 1 `HINIGARAN NATIONAL HIGH SCHOOL`, id 261 present (test) | 2 (unchanged) | PASS |
| P5 | `atlas_auth_accounts` | 44 | 44 | 44 | PASS |
| P6 | `subjects` | 22 | 22 | 22 | PASS |
| P7 | `section_mirrors` | 40 | 40 | 40 | PASS |
| P8 | `faculty_mirrors` | 42 | 42 | 42 | PASS |
| P9 | `teaching_load_cycles` | 2 | 2 | 2 | PASS |
| P10 | `generation_runs` | 1 | 1 | 1 | PASS |
| P11 | `published_schedule_revisions` | 0 | 0 | 0 | PASS |
| P12 | `audit_logs` | 247 (authoring) / 248 (F2 carry) | 248 | 248 (delta 0) | PASS |
| — | public tables / enum types | 44 / 23 | 44 / 23 | 46 / 23 (+2 tables = the two new tables; enums unchanged) | PASS |

No divergence from §3 was observed, so the L1 STOP condition did not trigger and
the backup and apply proceeded.

## 4. Backup identity (the recorded rollback authority, packet §6)

| Field | Value |
| --- | --- |
| Archive path | `D:\ATLAS-database-recovery\backups\atlas-backup-atlas_recovery_clean_rebuild_20260905-20260917-110058.dump` |
| Manifest path | `D:\ATLAS-database-recovery\backups\atlas-backup-atlas_recovery_clean_rebuild_20260905-20260917-110058.dump.manifest.json` |
| byteSize | 270517 |
| sha256 | `a989f3c95750cca5cdd45bdaea6f785e4374690e53e2b244d7ef05a9d324239d` |
| restoreListEntries | 464 |
| Target | `localhost:5432/atlas_recovery_clean_rebuild_20260905` |
| `createdAt` | `2026-09-17T11:00:58.701Z` (19:00:58.701 +08) — after the L1 re-measure |
| clientVersion / serverVersion | 18.1 / 18.1 |
| `dumpExitCode` / `restoreListExitCode` / `valid` | 0 / 0 / `true` |
| Manifest counts | schools 2, authAccounts 44, facultyMirrors 42, sectionMirrors 40, subjects 22, buildings 8, rooms 103, teachingLoadCycles 2, generationRuns 1 |

The pre-existing scheduled archive `atlas-backup-…-20260916-140003.dump`
(270493 B) was **not** substituted; the wrapper selected the freshly created
manifest by name, as shown in the `MIGRATE_GATE_OK` line (pre-action finding F3).

## 5. Commands actually run and decisive output

Environment: `DATABASE_URL` was set inside each process from
`D:\ATLAS-runtime-config\atlas-server.env` and never printed, echoed, or written
to any repository file. For the read-only SQL probes the `PG*` variables were
derived from `DATABASE_URL` inside the process (`PGHOST=localhost`,
`PGPORT=5432`, `PGDATABASE=atlas_recovery_clean_rebuild_20260905`) and never
printed.

1. **L1 re-measure** (read-only), from the worktree root:
   `psql -X -q -A -F '|' -v ON_ERROR_STOP=1 -P pager=off -f "%TEMP%\opencode\mig-apply-l1.sql"`
   → exit 0; results in §3.

2. **L2 backup**, from `atlas-server/`: `npm run backup`
   → exit 0; decisive line:
   `BACKUP_OK target=localhost:5432/atlas_recovery_clean_rebuild_20260905 archive=atlas-backup-atlas_recovery_clean_rebuild_20260905-20260917-110058.dump bytes=270517 sha256=a989f3c95750cca5cdd45bdaea6f785e4374690e53e2b244d7ef05a9d324239d restoreListEntries=464`

3. **L2 validation**, from `atlas-server/`:
   `npx tsx src/scripts/atlas-backup.ts validate --manifest "D:\ATLAS-database-recovery\backups\atlas-backup-atlas_recovery_clean_rebuild_20260905-20260917-110058.dump.manifest.json"`
   → exit 0; decisive line:
   `VALIDATE_OK archive=atlas-backup-atlas_recovery_clean_rebuild_20260905-20260917-110058.dump sha256=a989f3c95750cca5cdd45bdaea6f785e4374690e53e2b244d7ef05a9d324239d target=atlas_recovery_clean_rebuild_20260905`

4. **Apply** (packet §5), from `atlas-server/`, no forwarded arguments:
   `npm run migrate:guarded` (wrapper spawns `npx prisma migrate deploy --schema ../prisma/schema.prisma`)
   → exit 0; decisive lines:
   ```
   MIGRATE_GATE_OK target=atlas_recovery_clean_rebuild_20260905 manifest=atlas-backup-atlas_recovery_clean_rebuild_20260905-20260917-110058.dump.manifest.json
   Prisma schema loaded from ..\prisma\schema.prisma
   Datasource "db": PostgreSQL database "atlas_recovery_clean_rebuild_20260905", schema "public" at "localhost:5432"
   4 migrations found in prisma/migrations
   Applying migration `0002_companion_sso_code`
   Applying migration `0003_teacher_program_presentation`
   All migrations have been successfully applied.
   ```
   (The wrapper's `node ... [DEP0190] DeprecationWarning` about `shell: true` is a
   pre-existing benign Node warning from `spawnSync(..., { shell: true })`; it
   does not affect the migration result.)

5. **L3–L7 verification** (read-only), from the worktree root:
   `psql … -f "%TEMP%\opencode\mig-apply-l3l7.sql"`
   → exit 0; results in §3.

6. **L8 health** (read-only GET):
   `http://localhost:5001/api/v1/health/ready` → 200 `{"status":"ready","service":"atlas","checks":{"database":"ok"}}`
   `https://njgrm.buru-degree.ts.net/api/v1/health/ready` → 200 (same body)
   `http://localhost:5001/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`
   `https://njgrm.buru-degree.ts.net/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`

All raw logs/scratch SQL were kept in `%TEMP%\opencode` and were never committed.

## 6. Supersession of the `0003` header note

`prisma/migrations/0003_teacher_program_presentation/migration.sql` header
(blob `af89adc7…`, LF-SHA-256 `b3270f02…`) currently states:

> `-- Source only. This migration is NOT applied to the shared/live database; it is`
> `-- proven on a disposable PostgreSQL database by the export-presentation suite.`

That note is **superseded by this approved action**. As of
`2026-09-17T19:01:46.236355+08`, `0003_teacher_program_presentation` is applied
to `atlas_recovery_clean_rebuild_20260905` with `finished_at` non-null and
`rolled_back_at` null, and its table, indexes, and FK are present per L5. The
header text was **not** edited (every migration file is forbidden to this
executor); the supersession is recorded here as instructed by packet §1/§4. Any
future reader must treat the in-file note as historically stale.

## 7. Rollback statement (packet §8; not executed)

No mandatory verification failed, so no rollback was performed. The defined
rollback remains bounded to the approved §9 sentence:

- **Level 1 — additive object rollback** (if an anomaly is limited to the two new
  tables): `DROP TABLE IF EXISTS "companion_sso_codes";` and
  `DROP TABLE IF EXISTS "teacher_program_presentation_revisions";` — nothing
  else. `_prisma_migrations` is never hand-edited; because Level 1 leaves the two
  registry rows claiming the migrations ran, that state is a deliberate decision
  point where the executor stops, reports the exact state, and no further apply
  is attempted without a separately authorized supported `prisma migrate resolve`
  or a Level 2 restore.
- **Level 2 — restore** the §4 pre-apply backup when any anomaly extends beyond
  the two new tables. That restore returns the pre-apply instant (including the
  2-row registry) and is itself a destructive HIGH action requiring its own
  explicit authority at that moment.

No other object was touched, and no reset/force-reset was run.

## 8. Approvals, boundaries, and statements

- Only the six approved actions of the recorded `WF-C10` approval were performed:
  the L1 re-measure, the fresh validated backup, the guarded apply, the L3–L8
  read-only verification, the bounded rollback definition (not executed), and the
  docs-only evidence record.
- No login, browser session, deployment, runtime restart, scheduled-task or
  environment change, generation, publication, companion action, or migration
  beyond the two approved files occurred.
- No `ops/workflow/transition.mjs` transition was run. **No register file was
  edited by the executor.** **No receipt was minted by the executor.**
- The shared runtime was observed read-only via health GETs and was not
  restarted; it continued serving the deployed release throughout.
