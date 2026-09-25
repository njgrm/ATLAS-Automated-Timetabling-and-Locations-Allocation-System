# Deployment packet — `861d89a2` ACTIVE-TERM-LIVE-RESOLUTION-C02 (2026-09-25)

HIGH supervised-runtime cutover. The operator's 2026-09-20 standing authorization covers this
program's deployment/browser acceptance subject to every pre-action, executor, and post-action gate;
this packet does not waive evidence. No migration, generation, publication, or live-data write is
authorized.

## Exact boundary

- **Target product:** `861d89a2bc2682c5f875dde0b4b1d8ffc079b1fe` (`origin/main`).
- **Target release:** `E:\ATLAS-runtime-supervised-861d89a2-20260925` (detached registered worktree).
- **Incumbent / rollback:** `eb0e30386336673a4a31ecfe39a9bef93549e0ed` at
  `E:\ATLAS-runtime-supervised-eb0e3038-20260925`.
- **Dependency donor:** `E:\ATLAS-runtime-supervised-5c100ea6-20260925` (frozen, direct dependency
  source; never copy dependencies from the production incumbent).
- **Behavioral production delta:** the ten accepted `ACTIVE-TERM-LIVE-RESOLUTION-C02` paths: six
  server services, two new tests, the C01 supersession test, and `atlas-server/package.json`.
  The range also carries docs/config already on `origin/main`; no client production path changes.
- **No migration / schema / SQL / lockfile change.**
- **Out of scope:** generation, publication, availability/Teaching Load writes, term-cache apply,
  rollover sync, browser UI acceptance, F1/F2 follow-ups, companion repositories, or any data repair.

## Pre-action gates

1. A fresh independent pre-action reviewer reviews the immutable product range
   `eb0e3038...861d89a2` and this packet's acceptance-satisfiability lint in one pass. `ACCEPT_READY`
   requires `passed == total`, `blocked: 0`, `unperformed: 0`.
2. The exact target is recorded in the `## Live release` block on `origin/main` before the runner.
3. Standing authorization permits execution after gates pass; any stale identity, correction, or
   failed gate stops the cycle.

## Executor sequence

1. Re-derive task action, machine source/release, active supervisor state, and 5001/5174 listener
   lineage read-only. Require the exact incumbent; return `PACKET_STALE` before mutation on drift.
2. Recheck capacity (E warns <50 GiB/fails <25; D warns <25/fails <15), target path, and donor
   existence/cleanliness/no borrower/non-reparse dependency trees/lockfile equality. If E is below
   50 GiB, stop before creating the release and run the audited retention reclaim; do not build until
   the post-reclaim capacity is rechecked.
3. Add the exact detached target worktree. Copy donor root/server/client `node_modules` as real
   directories using the frozen donor procedure; no `npm ci`, implicit `npx`, or junction chain.
4. Run `npx --no-install prisma generate --schema ../prisma/schema.prisma`, server build,
   `test:active-term-live-resolution-c02` (13/13), `test:active-term-live-resolution-c02-postgres`
   (6/6), `test:active-term-live-resolution` (8/8), and the 18-file server preservation subset
   (196/196). The named preservation files are
   `tt-source-freshness-generation-c04`, `tt-source-freshness-capability-c04`,
   `tt-source-freshness-quick-place-c04`, `tt-source-freshness-sync-pin-c04`,
   `publication-contract-readiness`, `published-revision-identity`, `published-identity-readback`,
   `published-swap-term`, `publication-contract-postgres-concurrency`,
   `term-contract-atlas-consumption-c02`, `term-subject-authority`,
   `generation-authority-realism-c07-term-authority`, and the C01 supersession file. Run the client
   term-gate preservation set and record its exact base-identical tally. Run client typecheck/build
   with the literal `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` build guard even though
   no client source changed.
5. Start the built target server directly on isolated port 5198 with `PORT=5198` and
   `ROLLOVER_AUTO_SYNC_ENABLED=false` explicitly set in the child environment. A direct start bypasses
   the supervisor, so the runtime-contract invariant is not applied; without the explicit flag the
   isolated process arms an unattended rollover tick against the live `DATABASE_URL` 300 seconds after
   `listen`. Require health 200, `/api/v1/health/ready` 200 with `database:"ok"`, and DB-backed
   `GET /api/v1/subjects?schoolId=1` 200. Stop the PID actually listening on 5198 and prove the port
   is clear. Never touch 5001/5174.
6. Capture the six-table zero-write SQL digest immediately before cutover. Run the elevated
   `deploy-runner.ps1` dry-run, verify exact target/incumbent, `mutates=false`, `secretsPrinted=false`,
   live-state gate, one lineage, and rollback, then repeat with `-Execute`.
7. Capture post-cutover digest before any browser/data action. The runner is the only task/env/
   listener cutover owner. Do not improvise rollback.

Runner arguments for both dry-run and `-Execute`:

```powershell
& "E:\ATLAS-runtime-supervised-861d89a2-20260925\ops\runtime\deploy-runner.ps1" `
  -TargetSha "861d89a2bc2682c5f875dde0b4b1d8ffc079b1fe" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-861d89a2-20260925" `
  -IncumbentSha "eb0e30386336673a4a31ecfe39a9bef93549e0ed" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-eb0e3038-20260925" `
  -EnvFile "D:\ATLAS-runtime-config\atlas-server.env"
```

## Post-action independent QA rows

One fresh read-only `atlas-qa` closes all rows with a real passed/blocked/unperformed tally:

| # | Row | Deciding harness |
|---|---|---|
| Q1 | Exact target live | Task action, machine env, active state, listeners, and one target `cli.mjs` lineage name `861d89a2` / target directory. |
| Q2 | Local runtime | `/api/v1/health` 200; `/api/v1/health/ready` 200 with `database:"ok"`; DB-backed `GET /api/v1/subjects?schoolId=1` 200. |
| Q3 | Tailnet | Tailnet health 200 with origin asserted. |
| Q4 | Deployed active-term behavior | With the operator-seeded QA session, make exactly two authenticated `GET /api/v1/generation/1/10/readiness/diagnostic` calls from a non-timetable same-origin page. Assert 200, school 1/year 10, `ran=true`, `zeroWrite=true`, first `cached=false`, second `cached=true`; record timings/log window. No login, no `/timetable` navigation, no extra readiness call. `NEEDS_SESSION` blocks rather than substituting a claim. |
| Q5 | Startup evidence | Target log records target start, listeners, DB/schema checks, and no fatal startup/listener/schema error. |
| Q6 | Zero live-data write | Run the exact SQL in the Zero-write SQL section below through the durable env without printing values; record the literal command, database name, and serialization. Pre/post digests must match before Q4/browser activity. |
| Q7 | Focused controls | Independently rerun C02 13/13, C02 PostgreSQL 6/6, C01 8/8, the 18-file server preservation subset 196/196, the named term/publication/source-freshness files listed in step 4, and the client term-gate preservation set; report base-only failures separately. |
| Q8 | Acceptance honesty | `ACCEPT_READY` only if every row passed, `passed == total`, `blocked: 0`, `unperformed: 0`; this is deployment acceptance, not generation/publication acceptance. |

## Zero-write SQL

Run this exact read-only SQL through the durable env without printing values, with `SET TIME ZONE 'UTC'`, and record the literal command, database name, and serialization. Pre/post digests must match before Q4/browser activity.

```sql
SET TIME ZONE 'UTC';
SELECT 'audit_logs' AS table_name,
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\\n' ORDER BY id), '')) AS digest
FROM audit_logs x
UNION ALL
SELECT 'generation_runs', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\\n' ORDER BY id), ''))
FROM generation_runs x
UNION ALL
SELECT 'manual_schedule_edits', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\\n' ORDER BY id), ''))
FROM manual_schedule_edits x
UNION ALL
SELECT 'published_schedule_revisions', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\\n' ORDER BY id), ''))
FROM published_schedule_revisions x
UNION ALL
SELECT 'faculty_availabilities', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\\n' ORDER BY id), ''))
FROM faculty_availabilities x
UNION ALL
SELECT 'faculty_availability_slots', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\\n' ORDER BY id), ''))
FROM faculty_availability_slots x
ORDER BY table_name;
```

## Rollback

On runner failure, absent listener, target startup failure, identity drift, or nonzero digest, stop and
use only the captured rollback path. Deploy-as-restore to `eb0e3038` is a separate HIGH action with
its own evidence if ports clear and the target cannot start. No generation, publication, or data
apply is part of this packet.
