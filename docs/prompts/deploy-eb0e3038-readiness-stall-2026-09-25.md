# Deployment packet — `eb0e3038` READINESS-STALL-C01 (2026-09-25)

HIGH supervised-runtime cutover. This packet covers the reviewed source range, release build,
runner dry-run, `-Execute`, and independent post-action QA. Deployment and acceptance remain
separate outcomes. The operator approval gate is still open; no release-directory build or
runtime action is authorized by this packet alone.

## Exact boundary

- **Product target:** `eb0e30386336673a4a31ecfe39a9bef93549e0ed` (`origin/main` at packet authoring).
- **Incumbent / rollback basis:** `c5e167d7c5939ff586880149c566ce29506430e8` at
  `E:\ATLAS-runtime-supervised-c5e167d7-20260925`.
- **Target release directory:** `E:\ATLAS-runtime-supervised-eb0e3038-20260925` (detached registered
  worktree at the exact product SHA).
- **Env file:** `D:\ATLAS-runtime-config\atlas-server.env`; never print its values.
- **Behavioral production delta:** exactly two server service files —
  `atlas-server/src/services/generation-readiness.service.ts` and
  `atlas-server/src/services/timetable-candidate-domain.ts` — plus the committed readiness test and
  `atlas-server/package.json` test wiring. The range also carries docs/config changes already on
  `origin/main`; there are no client production changes.
- **No migration / schema / SQL / lockfile change:** the target range has no `prisma/**`, migration,
  schema, SQL, or lockfile path. The previously reported applied count of 11 is context only; no
  migration command is authorized and no schema recheck is required for this action.
- **Out of scope:** generation, publication, timetable-data writes, Teaching Load/availability
  writes, account/role/SSO changes, companion changes, and any other runtime/listener swap.

## Pre-action gate and approval

1. One fresh independent pre-action reviewer must review the immutable range
   `c5e167d7...eb0e3038` and this packet's acceptance-satisfiability lint in one pass. It may return
   `ACCEPT_READY` only with `passed == total`, `blocked: 0`, and `unperformed: 0`.
2. The target SHA must be recorded in the `## Live release` section on `origin/main` before the
   runner is invoked. That docs-only record is a prerequisite, not deployment approval.
3. Before creating the release tree or invoking either dry-run or `-Execute`, present the exact
   target, delta, no-migration boundary, rollback, and verification to the operator and wait for a
   clear go-ahead. `CORRECTION_REQUIRED`, stale identity, or absent approval stops the cycle.

## Executor sequence

1. Re-derive live identity read-only from the scheduled-task action, machine
   `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA`, the active source's
   `ops/runtime/logs/supervisor-state.json`, and the 5001/5174 listener parent lineage. Require the
   exact incumbent above. If either listener is absent, the task/action or machine identity differs,
   or the active state is not running for the declared source, return `PACKET_STALE` before mutation.
2. Recheck capacity: E: warns below 50 GiB and fails below 25 GiB; D: warns below 25 GiB and fails
   below 15 GiB. Verify the target parent exists and the exact target path is absent. Preserve every
   dirty, active, uncertain, or rollback worktree.
3. Add the exact detached target worktree. Do not copy dependency trees from the incumbent release: it is production-only and lacks the required TypeScript/test/client build executables. Use `E:\ATLAS-runtime-supervised-5c100ea6-20260925` as the frozen dependency donor for this action. Immediately before copying, require that the donor still exists, is detached and clean, has no process borrower, has real non-reparse root/server/client `node_modules` directories, and has root/server/client lockfiles byte-equal to the target worktree. Preserve the donor through target build and deployment.

   Copy the donor's root, server, and client `node_modules` trees into the corresponding target
   directories as real directories using `robocopy /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ`; accept
   robocopy exit codes 0–7 and fail on 8 or above. Do not run `npm ci`, do not permit an implicit
   `npx` download, and do not create a junction. Verify the target contains
   `atlas-server/node_modules/.bin/tsx.cmd`, `atlas-server/node_modules/.bin/tsc.cmd`,
   `atlas-client/node_modules/.bin/tsc.cmd`, `atlas-client/node_modules/.bin/vite.cmd`, and local
   Prisma before continuing.
4. From `atlas-server`, run `npx --no-install prisma generate --schema ../prisma/schema.prisma`, then
   `npm run build`, `npm run test:readiness-stall`, `npm run test:request-timing`, and
   `npm run test:server-suite`. The readiness suite must be 7/7 and request timing 6/6; the full
   server suite must reproduce the recorded 337/341 baseline with the same four pre-existing
   `tt-output-c03r` failures, or stop for review. From `atlas-client`, run `npm run typecheck` and
   `npm run build` with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` so the release
   artifact is complete even though no client production file changed. Record every exit code and tally.
5. Start the built target server on isolated port 5198 with the durable env injected without
   printing values. Require health 200 and DB-backed `GET /api/v1/subjects?schoolId=1` 200. Stop the
   PID actually listening on 5198 and prove the port is clear. Do not touch 5001/5174.
6. Capture the exact pre-cutover zero-write database signature with the SQL below after the build and
   immediately before `-Execute`, with no browser activity in the interval.
7. Run `ops/runtime/deploy-runner.ps1` in an elevated Administrator shell without `-Execute` first.
   Review the redacted plan: exact target/incumbent, `mutates=false`, `secretsPrinted=false`, target
   live-state gate satisfied, one supervisor lineage, and rollback recorded. Stop on any mismatch.
8. Repeat the identical runner arguments with `-Execute`. The runner is the sole task/env/listener
   cutover owner. Do not manually stop/restart the supervisor or edit task/env variables.
9. Capture the post-cutover zero-write signature before any browser or data action. Report the runner
   audit paths, build results, and the exact target identity. Do not perform Lane C's two timetable
   reloads or any browser acceptance in the executor.

Runner arguments for both dry-run and `-Execute`:

```powershell
& "E:\ATLAS-runtime-supervised-eb0e3038-20260925\ops\runtime\deploy-runner.ps1" `
  -TargetSha "eb0e30386336673a4a31ecfe39a9bef93549e0ed" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-eb0e3038-20260925" `
  -IncumbentSha "c5e167d7c5939ff586880149c566ce29506430e8" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-c5e167d7-20260925" `
  -EnvFile "D:\ATLAS-runtime-config\atlas-server.env"
```

## Zero-write signature

Run read-only through the durable env without printing it, with `SET TIME ZONE 'UTC'`. Record the
literal SQL, command, output, timestamp, and database name. Before/after digests must match; any
 delta is an incident stop.

```sql
SET TIME ZONE 'UTC';
SELECT 'audit_logs' AS table_name,
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), '')) AS digest
FROM audit_logs x
UNION ALL
SELECT 'generation_runs', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM generation_runs x
UNION ALL
SELECT 'manual_schedule_edits', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM manual_schedule_edits x
UNION ALL
SELECT 'published_schedule_revisions', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM published_schedule_revisions x
UNION ALL
SELECT 'faculty_availabilities', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM faculty_availabilities x
UNION ALL
SELECT 'faculty_availability_slots', md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM faculty_availability_slots x
ORDER BY table_name;
```

## Post-action independent QA rows

One fresh read-only `atlas-qa` closes all rows below and reports a real mandatory tally. A green
helper test, health response, or source QA does not substitute for a live row.

| # | Row | Deciding harness / evidence |
|---|---|---|
| Q1 | Exact product target live | Task action, machine env, active target state, listeners and one target `cli.mjs` parent lineage all name `eb0e3038` / target directory. |
| Q2 | Local runtime | `/api/v1/health` 200, `/api/v1/health/ready` 200 with `database:"ok"`, and `GET /api/v1/subjects?schoolId=1` 200. |
| Q3 | Tailnet | Tailnet `/api/v1/health` 200 with origin asserted. |
| Q4 | Server-only target proof and cold/warm API behavior | Before any browser activity or any other readiness request, use the retained QA-owned authenticated session/harness to issue two identical `GET /api/v1/generation/1/10/readiness/diagnostic` requests. Both must return 200 with `readiness.scheduler.ran === true`, `readiness.databaseSignature.zeroWrite === true`, and exact school/year scope. The first response must contain `readiness.scheduler.cached === false`; the second must contain `readiness.scheduler.cached === true`. Record both response timings and the supervisor-log window. This is the server-only proof that the deployed target contains the reviewed behavior; no new client chunk is required. If the retained session is unavailable, report `NEEDS_SESSION(atlas-qa/<profile>)` and block Q4 rather than logging in or inferring approval. |
| Q5 | Startup log | Target supervisor log contains target start and no fatal startup/listener/schema error. |
| Q6 | Zero live-data write | Exact pre/post SQL digests match for all six tables, captured before any browser action. |
| Q7 | Focused controls and named preservation suites | From the exact target `atlas-server`, run `npm run test:readiness-stall` (7/7), `npm run test:request-timing` (6/6), and `npx --no-install tsx --test src/__tests__/timetable-candidate-domain.test.ts src/__tests__/generation-canonical-readiness-genc02.test.ts` (28/28). |
| Q8 | Acceptance honesty | `ACCEPT_READY` only if every Q row passed with `passed == total`, `blocked: 0`, `unperformed: 0`; deployment is not global browser acceptance. |

## Separate acceptance after QA

**A1 — Lane C production `/timetable` reload acceptance, after Q1–Q8:** Take a supervisor-log cursor after Q4 has completed its mandatory cold/warm API sequence. Lane C then reloads production `/timetable` twice. Both reload readiness responses must expose `scheduler.cached === true`; record their actual timings and all new slow-request/event-loop-stall lines. The acceptance row passes only when neither reload produces a new event-loop-stall line attributable to the readiness diagnostic. Do not describe the first Lane C reload as cold or expect the original approximately 1.2-second cold value: Q4 has already consumed the cold scheduler-cache entry. Q4 owns the cold/warm proof; A1 owns the separate production warm-reload regression check. No generation, publication, or timetable-data write is part of A1.

## Rollback and failure handling

- Runner failure before quiescence: use only its captured rollback; do not improvise.
- If ports clear and the target cannot start, restore captured task XML and machine runtime values,
  then start the exact `c5e167d7` rollback release as deploy-as-restore with the same evidence gates.
- Incumbent identity drift after approval means `PACKET_STALE`; stop and re-plan.
- Nonzero zero-write digest, missing listener, unexpected shared-data mutation, or credential
  disclosure is an incident stop; preserve evidence and do not continue.
