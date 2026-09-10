# TERM-LIVE-PREVIEW — Live Schema Migration Preview (0001_term_subject_authority)

Status: `REVIEW_REQUIRED`
Risk: `HIGH` (live schema apply preview; no mutation authorized or performed)

## Boundary

- Repository: `D:\ATLAS`
- Managed worktree: `D:\ATLAS-worktrees\term-live-migration-preview`
- Branch: `work/term-live-migration-preview`
- Base / integrated ancestor: `36c5d3d1735728c1870f5e0ccfe36ca54a8a6b5d` (`origin/main` HEAD)
- Migration preview only. No Prisma schema, migration SQL, product source, tests,
  or runtime configuration were modified. EnrollPro/AIMS/SMART were not contacted.
- No live schema/data mutation, no `prisma migrate deploy` against live, no
  restart of the port-5001 server, no rollover/sync/generation/publication.

## Durable outputs

- `docs/verification/term-subject-live-migration-preview-2026-09-11.json`
- `docs/verification/term-subject-live-migration-preview-2026-09-11.json.sha256`
  (`063816432C11FFD7A3B91D6BBFF0808846CDCF48AE7B6CCF16A5229CDB942D5D`)
- `docs/progress/term-subject-live-migration-preview-2026-09-11-progress.md`
- `CHANGELOG.md` entry

## Live read-only preflight

- Target (sanitized): `localhost:5432 / atlas_recovery_clean_rebuild_20260905`,
  user `atlas_user`, PostgreSQL `18.1`. Intended target confirmed.
- Migration history: only `0000_clean_baseline` (finished).
- `0001_term_subject_authority` absent; enum `subject_scheduling_disposition`
  absent; `subjects.scheduling_disposition`,
  `enrollpro_school_year_mirrors.term_contract_cache`, and
  `.term_contract_cached_at` absent.
- Catalog: `1` school, `22` subjects, `2` school-year mirrors.
- Predicate `UPPER(BTRIM(code)) = 'HG'` matches exactly `1` live row:
  `id=7`, `code=HG`, `name=Homeroom Guidance`, `is_active=t`.
- Live signatures: schema `ca0cae04d620a7390ce836aff68354d5`,
  enum `3947fe756e8b97b05ec5e4edbf2b7998`,
  subject data `2adf940a43c8fc25425766ed3504bb78`.
- Fail-closed checks all passed: expected target, no partial apply, no schema
  drift outside the accepted migration, no conflicting enum/column, and no rows
  beyond the predicate would change.

## Backup proof

- Created through the accepted workflow (`atlas-backup.ts backup`).
- Archive: `atlas-backup-atlas_recovery_clean_rebuild_20260905-20260910-165235.dump`.
- Bytes `266979`; manifest and recomputed SHA-256 match
  (`b5e5d9faa90b528079f3e1c317f34930ffebf74e50f93e6a7cca945e22b57e3c`).
- `pg_restore --list` exit `0`, `463` TOC entries; stored-manifest validate `OK`.
- Not restored over any existing or live database.

## Disposable migration proof

All disposable databases were created under the local PostgreSQL instance and
dropped in guaranteed cleanup.

1. `atlas_term_live_preview_20260911_a` — baseline restored from the verified
   backup, a synthetic `ALT_HG` subject named "Homeroom Guidance" inserted, then
   the exact `migration.sql` applied. Result: `HG` (`id=7`) = `REFERENCE_ONLY`;
   `ALT_HG` (different code, same name) = `SCHEDULED_TEACHING`; all other rows =
   `SCHEDULED_TEACHING`; `unexpectedReferenceOnlyCount=0`; enum and three
   columns present with the exact expected definitions; `45` public-table row
   counts identical before/after apply. Documented rollback left zero columns
   and zero enum entries. Dropped.
2. `atlas_term_live_preview_20260911_b` — baseline restored, then
   `prisma migrate deploy` applied `0001`; `migrate status` reported
   "Database schema is up to date!"; a second `deploy` reported
   "No pending migrations to apply." (idempotent/no-op). Dropped.
3. `atlas_term_live_preview_20260911_rt` — isolated built-server smoke database.
   Dropped.

Post-proof leftover preview databases: `0`.

## Compatibility and guard proof

- `prisma validate` — valid.
- `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...`
  produced exactly the accepted migration DDL (`CREATE TYPE`, two `ADD COLUMN`
  groups) with zero extra drift operations.
- Server `npm run build` (`tsc`) — pass; `dist/server.js` present.
- Isolated built server on port `5099` against a restored disposable database,
  `ROLLOVER_AUTO_SYNC_ENABLED=false`: `/api/v1/health` returned `200`; the
  `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` line was
  present and no `[rollover-automation] Starting` line appeared. The process was
  stopped and port `5099` was released. Port `5001` was never touched.

## Zero live mutation proof

The identical read-only preflight SQL produced byte-identical output before and
after all work. `0001` remains absent, the enum and columns remain absent, and
schema/enum/subject-data signatures are unchanged. Port `5001` is still owned by
the same live process.

## Risks and recovery

- `schedulingDisposition` remains `PENDING_DERIVED_DEMAND_INTEGRATION`; only
  exact code `HG` is reference-only and no operative behavior changes.
- Apply through `npm run migrate:guarded` (revalidates the exact backup
  immediately before spawning Prisma); bare `prisma migrate deploy` is forbidden.
- Recovery: the documented rollback drops the three added columns and the enum;
  worst case restores the verified archive through the accepted recovery
  workflow. Restore-over-live is never automatic.

## EnrollPro note

EnrollPro deployment is not required for ATLAS schema compatibility, but remains
required for live term authority.

## Next action

Return `REVIEW_REQUIRED` for planner/QA acceptance. The proposed approval
sentence in the JSON artifact is `NOT ACTIVE` until that acceptance.

## TERM-LIVE-APPLY closure — 2026-09-11

Status: `APPLIED_VERIFIED`.

- Planner QA accepted the preview, integrated it, and received the exact
  operator HIGH approval sentence.
- Immediate preflight revalidated the approved archive and selected it as the
  newest fresh manifest for the exact configured target.
- A first guarded invocation failed before Prisma migration because the default
  command did not locate the root-level Prisma schema. Fresh status proved zero
  change. The successful retry used the wrapper's supported forwarded argument
  `--schema ../prisma/schema.prisma`; the backup gate reran and migration
  `0001_term_subject_authority` applied successfully.
- Post-state: both migrations applied; enum and three columns exact; 22 subjects
  distributed 21 scheduled / one reference-only; only canonical code `HG` is
  reference-only.
- Fourteen protected-domain count/hash checks changed only in the expected
  subjects row representation; Teaching Load, curriculum, generation,
  publication, identity, and audit domains were unchanged.
- Local and Tailnet health remained HTTP 200. Port 5001 was not restarted. Its
  Subjects response still lacks the new projection, so Wave-1 runtime deployment
  remains pending and separately controlled.
- Durable receipt:
  `docs/verification/term-subject-live-migration-apply-2026-09-11.md`.

Next: ordinary correction of the guarded command's default schema path, then a
bounded integrated-runtime deployment/acceptance pass. EnrollPro ordered term
authority remains an external dependency.
