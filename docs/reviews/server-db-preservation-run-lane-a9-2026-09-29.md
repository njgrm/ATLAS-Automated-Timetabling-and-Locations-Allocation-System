# Lane A9 — `test:server-db` preservation run (2026-09-29)

Authority: operator ruling 2026-09-29 — *"YES, run `npm run test:server-db` to close the
preservation row."* Recorded here because the numbers below are what a reviewer re-derives.

- Branch `work/teaching-personnel-only`, base `7eeffb82`, candidates `399f9d4a` (Task A) and
  `295b028a` (Task B).
- Target: the **local PostgreSQL server only** (`localhost:5432`). No migration, deployment,
  restart, task/env change, generation, publication, or login. No `.env` was modified and no
  `.env` was ever pointed at the live database.

## Literal command

Run from `E:/ATLAS-worktrees/lane-a9-personnel-type/atlas-server` as the committed script —
never as a bare `tsx --test` of a DB-writing file:

```
npm run test:server-db
```

The script's `DATABASE_URL` must itself be disposable (`run-db-suite.mjs:113-118` refuses
anything else). It was pointed at a throwaway admin database this cycle created and dropped:

```
atlas_restore_drill_20260928_a9admin
```

The credential came **read-only** from the repo dev `.env` (`D:/ATLAS/atlas-server/.env`, whose
`DATABASE_URL` names `atlas_staging`). It was read into a variable, never printed, and the file
was never written.

## Expected delta and rollback, as executed

Per file: `CREATE DATABASE atlas_restore_drill_<yyyymmdd>_<slug><hex> TEMPLATE <template>`, run
`npx tsx --test <file>`, then `DROP DATABASE ... WITH (FORCE)` in a `finally`
(`run-db-suite.mjs:186-231`). One template database is built first with `prisma migrate deploy`.
The runner drops only names it created (exact match); it never touches the admin or any other
database.

## Result

```
[server-db] files: 50 pass, 9 fail, 0 skipped-known-red | databases created: 60 (incl. template), residue of own databases: 0
```

**59 files** ran (58 in the pre-existing list plus the new
`rollover-reset-faculty-stale-a9.test.ts`). 60 databases were created — the template plus one per
file. Template used: `atlas_restore_drill_20260928_tplc54e68`. (The date stamp comes from
`new Date().toISOString()`, so it is the UTC date.)

The new suite passed: `[server-db] PASS src/__tests__/rollover-reset-faculty-stale-a9.test.ts
(2.7s) (database dropped)` — 21/21 assertions.

### Per-file results

| Result | File |
| --- | --- |
| PASS | capability-override-mount, class-template-authority-c07, class-template-authority-c07-guard, companion-direct-federation-c04, curriculum-decision-candidates, curriculum-requirements-concurrency, curriculum-requirements-truth, dashboard-http-authority, dashboard-lifecycle-truth, dashboard-stale-readiness, department-authority-apply, department-authority-gates, derived-demand-correction-c01r2, enrollpro-rollover-lifecycle-closure, **rollover-reset-faculty-stale-a9**, export-presentation-postgres, export-presentation-route, export-presentation-schema-guard-c06b, faculty-sync-publication-cas-c01, generation-authority-realism-c07-availability, generation-passive-teaching-load, generation-readiness-disposable-genc02r, generation-stakeholder-shape-genc02r, publication-contract-postgres-concurrency, published-day-boundary-a2, published-revision-authority-c12, runtime-router-actor-scope, section-route-authority-c03, slot-break-authority-c11, slot-break-authority-c11r, subject-catalog-truth, teaching-load-reconciliation, teaching-load-reconciliation-route, teaching-load-suggestion-apply-parity, teaching-load-suggestion-authority, teaching-load-suggestion-authority-c03, teaching-load-summary-zero-write-route, term-cache-catchup-rrtc01, term-contract-cache-instrumentation, term-subject-authority-http, timetable-candidate-domain, tt-output-c03r3-placement-term, tt-output-c03r-route, tt-source-freshness-capability-c04, tt-tl-authority-guard-c04, tt-tl-modules-contract, notification-inbox-postgres, timetable-truthfulness-c01, smart-draft-read-s3, special-event-scope-c01 |
| FAIL | enrollpro-rollover-automation, published-immutability-c08, teaching-load-carry-forward-postgres, teaching-load-suggestion-derived-demand-c03r2, timetable-ttc02-insertion, tt-source-freshness-generation-c04, tt-source-freshness-quick-place-c04, tt-source-freshness-sync-pin-c04, tt-warning-realism-c07a |

### The 9 failures are pre-existing, proven by a base-revision control

Not asserted — reproduced. The working tree was reverted to `7eeffb82` for the candidate's paths
(`git checkout 7eeffb82 -- atlas-server/src/__tests__/ atlas-server/package.json
atlas-server/src/services/enrollpro-rollover.service.ts`), the same 9 files were re-run through
the same harness, and the tree was then restored with `git checkout HEAD -- …`:

```
[server-db] files: 0 pass, 9 fail, 0 skipped-known-red | databases created: 10 (incl. template), residue of own databases: 0
```

All 9 fail identically at base. A set-difference of the failure signatures between the two runs
returns **zero** signatures present in the candidate but absent from the base; the base's 18
distinct failure signatures all appear in the candidate run too. Representative, all at base:
`TERM_FILTER_NOT_READY` active-term order, `GENERATION_PREFLIGHT_BLOCKED`, grade-7 REGULAR section
scope, display-order carries (expected 2, got 3), the five `* interleave must surface the typed
stale error` rows, and the 120/135/180/45 period-length boundary rows.

`enrollpro-rollover-automation` — the suite that caused the 2026-09-29 incident — reports
`67 passed, 1 failed` identically before and after; the guard changes nothing about its assertions,
it only refuses to run it against a non-disposable database.

## Zero-residue verification (not assumed — the `finally` was checked)

Query, run after the run and after dropping the admin database:

```sql
SELECT datname FROM pg_database WHERE datname LIKE 'atlas_restore_drill_%' ORDER BY datname;
```

Output:

```
                       datname
-----------------------------------------------------
 atlas_restore_drill_20260927_a2start4c39f0
 atlas_restore_drill_20260927_a2starte99d7e
 atlas_restore_drill_20260927_a2swap0a4ce0
 atlas_restore_drill_20260927_a2swap5a1e7a
 atlas_restore_drill_20260928_a2notifdedupe1e9f17
 atlas_restore_drill_20260928_teachingloadsugges992c
 atlas_restore_drill_20260928_tplabb941
(7 rows)
```

```sql
SELECT count(*) AS drill_dbs_now FROM pg_database WHERE datname LIKE 'atlas_restore_drill_%';
-- drill_dbs_now = 7
```

**This is the exact pre-run baseline, unchanged.** Before the run the same query returned the
same 7 names. The run's own template (`…20260928_tplc54e68`) and all 59 per-file databases are
gone, and the admin database this cycle created (`…20260928_a9admin`) was dropped. The runner's
own check agrees: `residue of own databases: 0`.

**The 7 remaining databases are NOT this cycle's and were not touched.** They are dated
2026-09-27/28 and belong to other lanes' suites (`a2start`, `a2swap`, `a2notifdedupe`,
`teachingloadsugges`, plus an `…tpl…` template). They are stale leftovers that no lane cleaned up.
They are reported here rather than dropped: removing another lane's databases is not this lane's
authority. That they exist at all is why "zero `atlas_restore_drill_%` remaining" is not literally
true on this server — a fact the operator should rule on separately.

## Shared-database signature (read-only, before and after)

`atlas_staging` is what `D:/ATLAS/atlas-server/.env` points at, so it is the database a bare suite
run would corrupt. Counted before the failing-first proof and again at the end of the cycle:

```sql
SELECT (SELECT count(*) FROM schools) AS schools,
       (SELECT count(*) FROM faculty_mirrors) AS faculty_mirrors,
       (SELECT count(*) FROM faculty_subjects) AS faculty_subjects;
-- before: 2 | 47 | 458      after: 2 | 47 | 458
```

Unchanged. See `399f9d4a`'s guard proof for the refusal that keeps it that way.
