# Deployment packet — `c5e167d7` R1 + stall diagnostics (2026-09-25)

HIGH supervised-runtime cutover. This packet covers source-range review, release build, dry-run,
`-Execute`, and post-action QA. Deployment and acceptance remain separate outcomes.

## Exact boundary

- **Product target:** `c5e167d7c5939ff586880149c566ce29506430e8`.
- **Pending-record commit on `origin/main`:** `6ef21074` names the target and rollback in
  `docs/plans/live-state.md` before cutover.
- **Target release directory:** `E:\ATLAS-runtime-supervised-c5e167d7-20260925` (detached registered
  worktree at the exact product SHA).
- **Incumbent / rollback basis:** `ad8f971787cd004d9aeb040d362a9acd3e290074` at
  `E:\ATLAS-runtime-supervised-ad8f9717-20260925`.
- **Env file:** `D:\ATLAS-runtime-config\atlas-server.env`; never print its values.
- **Expected delta:** exactly 14 `atlas-client/**` files and 2 `atlas-server/**` files. The server
  delta is Lane C's `atlas-server/src/lib/request-timing.ts` plus its test; the client delta includes
  the accepted R1 size correction (`fb245772`, QA `ACCEPT_READY` 6/6/0/0) and scheduler warning /
  published-disclosure work already on the target history.
- **Schema / migration:** none. `ad8f9717..c5e167d7` changes no `prisma/**`, migration, schema or SQL
  path and no lockfile. No guarded migration command is authorized. The previously reported applied
  count of 11 is context only; this packet performs no schema action.
- **Out of scope:** generation, publication, Teaching Load or availability apply, deletion, account /
  role / SSO changes, companion-repository changes, and the Stage-2 active-term successor.

## Pre-action gate and approval

1. One fresh independent pre-action reviewer must review the immutable source range
   `ad8f9717...c5e167d7` and this packet's acceptance-satisfiability lint in one pass. It must return
   `ACCEPT_READY` only with `passed == total`, `blocked: 0`, and `unperformed: 0`.
2. Before any release-directory build or runner invocation, present this target, delta, no-migration
   boundary, rollback, and verification to the operator and receive a clear go-ahead. `CORRECTION_REQUIRED`
   or a stale incumbent stops the cycle; no partial execution.

## Executor sequence

1. Re-derive live identity from the scheduled-task action, machine `ATLAS_RUNTIME_SOURCE_DIR` /
   `ATLAS_RUNTIME_RELEASE_SHA`, the active source's `ops/runtime/logs/supervisor-state.json`, and the
   listeners/parent lineage on 5001 and 5174. Require the exact incumbent above. If either listener is
   absent, the task/action or machine identity differs, or the active state is not `running` for the
   declared source, return `PACKET_STALE` before creating or mutating anything.
2. Recheck capacity immediately before build: E: fails below 25 GiB and warns below 50 GiB; D: fails
   below 15 GiB and warns below 25 GiB. Verify the target parent exists and the exact target path does
   not. Preserve every dirty, active, uncertain, or rollback worktree.
3. Add the exact detached target worktree. The release owns copied dependencies: verify root, server,
   and client lockfiles are unchanged from the incumbent, then copy the incumbent release's own
   `node_modules` trees into the target as real directories. Do not run `npm ci`; do not create a
   junction into another release.
4. From `atlas-server`, run `npx prisma generate --schema ../prisma/schema.prisma`, then `npm run build`.
   Run `npm run test:request-timing`. Run client `npm run test:ux-audit-findings`,
   `npm run test:timetable-scheduler-clarity`, and `npm run typecheck`. Build the client with
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`; record every exit code and test tally.
5. Start the built server on isolated port 5198 with the durable env injected in-process and no printed
   values. Require health 200 and `GET /api/v1/subjects?schoolId=1` 200. Stop the PID actually listening
   on 5198, not a wrapper PID, and prove 5198 is clear. The target worktree must be clean at cutover.
6. Capture the pre-cutover zero-write database signature with the exact read-only SQL in the next section.
   It must be captured after the build and immediately before `-Execute`, with no browser activity in
   the interval.
7. Run `ops/runtime/deploy-runner.ps1` without `-Execute`. Review the emitted plan: exact target and
   incumbent, `mutates=false`, `secretsPrinted=false`, target live-state gate satisfied, one supervisor
   lineage, and rollback path recorded. Stop on any mismatch.
8. In an elevated Administrator shell, repeat the identical runner arguments with `-Execute`. The runner
   is the sole task/env/listener cutover owner. Do not stop the supervisor or modify task/env separately.
9. Capture the post-cutover signature before any browser or mutation. Report the executor commit/handoff,
   runner audit paths, build commands/results, and any stop/rollback evidence. Do not run browser
   acceptance inside the executor.

Runner arguments for both dry-run and `-Execute`:

```powershell
& "E:\ATLAS-runtime-supervised-c5e167d7-20260925\ops\runtime\deploy-runner.ps1" `
  -TargetSha "c5e167d7c5939ff586880149c566ce29506430e8" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-c5e167d7-20260925" `
  -IncumbentSha "ad8f971787cd004d9aeb040d362a9acd3e290074" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-ad8f9717-20260925" `
  -EnvFile "D:\ATLAS-runtime-config\atlas-server.env"
```

## Zero-write signature

Run read-only through the durable env without printing it, with `SET TIME ZONE 'UTC'`. Record the exact
SQL, command, output, timestamp, and database name. The before/after digests must match. Any delta is an
incident stop; do not normalize it away.

```sql
SET TIME ZONE 'UTC';
SELECT 'audit_logs' AS table_name,
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), '')) AS digest
FROM audit_logs x
UNION ALL
SELECT 'generation_runs',
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM generation_runs x
UNION ALL
SELECT 'manual_schedule_edits',
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM manual_schedule_edits x
UNION ALL
SELECT 'published_schedule_revisions',
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM published_schedule_revisions x
UNION ALL
SELECT 'faculty_availabilities',
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM faculty_availabilities x
UNION ALL
SELECT 'faculty_availability_slots',
       md5(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY id), ''))
FROM faculty_availability_slots x
ORDER BY table_name;
```

## Post-action independent QA rows

One fresh read-only `atlas-qa` closes all rows below and reports its own passed/blocked/unperformed
tally. A green helper test or health response alone cannot close the set.

| # | Row | Deciding harness / evidence |
|---|---|---|
| Q1 | Exact product target is live | Task action, machine env, active target `supervisor-state.json`, listeners and one parent lineage all name `c5e167d7` / target directory. |
| Q2 | Runtime serves target source | Local health 200 **and** ready 200 with `database:"ok"` **and** DB-backed `GET /api/v1/subjects?schoolId=1` 200. |
| Q3 | Tailnet path serves target | `https://njgrm.buru-degree.ts.net/api/v1/health` 200; origin asserted. |
| Q4 | New client bytes are proven | Fetch a hashed JS/CSS asset that exists only in the target build; served bytes and SHA-256 equal the local target build. The superseded entry must not be the served entry. |
| Q5 | Server startup is clean | Active supervisor log contains the target start and no fatal startup/listener/schema error after cutover. |
| Q6 | Deployment wrote no live data | Exact pre/post SQL digests above match for all six tables. Any browser/login/acceptance action occurred only after this row was captured. |
| Q7 | Source-specific focused controls | Independently rerun `test:request-timing`, `test:ux-audit-findings`, and `test:timetable-scheduler-clarity` on the exact target tree, with no path-gate failure. |
| Q8 | Acceptance is not overstated | QA verdict is `ACCEPT_READY` only if every row above passed and `passed == total`, `blocked: 0`, `unperformed: 0`; otherwise return the exact blocker. |

## Separate acceptance owners after QA

- **Lane A, seeded browser:** Tailnet `/timetable` at 1366x768 and 390x844; rendered timetable text is
  at least 14 px where R1 applies, there is no global/document scrollbar, the main timetable surface
  remains reachable, and console/network errors are recorded. Label this as post-deployment browser QA.
- **Lane C:** reproduce one draft swap preview on run 318 and read the new `[event-loop-stall]` /
  `[slow-request]` line. This is a read-only runtime acceptance row unless the preview contract itself
  writes; stop if it would mutate.

Deployment may be recorded `DEPLOYED` while either separate acceptance owner is pending. Do not call the
release accepted until both owners report their own real tallies.

## Rollback and failure handling

- Runner failure before quiescence: use the runner's captured rollback; do not improvise.
- If ports clear and the target cannot start, restore the captured task XML and machine runtime values
  and start the exact `ad8f9717` rollback release. This is deploy-as-restore and requires the same HIGH
  evidence gates.
- If the incumbent identity changed after approval, the packet is stale; stop and re-plan.
- A non-zero live-data signature delta is an incident stop. Preserve the evidence and do not continue.
- Unexpected shared-data mutation, a missing required listener, or a credential disclosure stops the
  cycle immediately.
