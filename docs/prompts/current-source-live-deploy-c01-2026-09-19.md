# CURRENT-SOURCE-LIVE-DEPLOY-C01

Status: **EXECUTED 2026-09-20 — independent post-action QA `ACCEPT_READY` 8/8
(blocked 0, unperformed 0).** Pin `7499916886707c35ea708a17ef7a87e791a6bade` was
deployed to `D:\ATLAS-runtime-supervised-74999168-20260920`; evidence
`docs/reviews/current-source-live-deploy-c01/evidence.md`. The path here was:
pre-action `ba9771a8` for pin `134bcf28`, repin to the tip, a blocking finding on
the repinned boundary (no startable rollback basis) resolved by
`PRISMA-CLIENT-REPAIR-C01`, then this r3 revision cleared. Residual for the next
revision of this packet: precondition 8's literal `row_to_json(t)` form must pin
its exact quoting and serialization, as the evidence addendum records. Do not
re-run this packet.

Risk: **HIGH** — supervised shared-runtime replacement

Target source: `7499916886707c35ea708a17ef7a87e791a6bade` (`origin/main` tip at repin)

Target release: `D:\ATLAS-runtime-supervised-74999168-20260920`

Worktree disposition: `RETIRE_AFTER_INTEGRATION`

Repin note: this packet was first prepared and independently reviewed for pin
`134bcf28b866f587f87afe8b9ba51c130d1e128b`. The pin above supersedes it by 32
commits. The repin is docs-only and changes no precondition, authorized
mutation, acceptance row, or rollback step, but the pin delta below must be
independently re-reviewed before the approval at the foot of this file is
executed.

## Objective

Deploy the integrated SMART-style shared chrome, selected-term public schedule,
warning-readability/actor-scope, direct-federation, Simple-workspace
simplification, section-route actor-school authority, and published-revision
publication-contract source to the supervised ATLAS runtime. SMART and AIMS
remain intentionally inactive because their peer implementations and paired
secrets do not yet exist.

This action performs no login, database write, migration, environment-file edit,
generation, publication, Teaching Load apply, rollover, or companion-repository
change.

## Repin delta — `134bcf28` → `74999168` (32 commits; 34 files, 20 non-docs)

- `atlas-client/src/components/timetable/**` (7 files, incl.
  `TimetableSimpleHeader.tsx`, `simple/**`, `ScheduleReviewWorkspace.tsx`) plus
  `atlas-client/src/lib/__tests__/ux-r02-simple-stripdown.test.ts`:
  Simple-workspace simplification and readable Simple chrome.
- `atlas-server/src/routes/section.router.ts` with
  `__tests__/section-route-authority-c0{1,2,3}.test.ts`: actor-school authority
  on the sibling section routes.
- `atlas-server/src/routes/published-revision.router.ts`,
  `atlas-server/src/services/published-revision.service.ts`,
  `atlas-server/src/services/manual-edit.service.ts`, with the C12 and
  publication-contract test files.
- `atlas-server/package.json`: two added npm test scripts
  (`test:section-route-authority`, `test:section-route-authority-c02`); no
  dependency change. This corrects the r2 text, which said "one dependency line".

The delta changes no port, no durable-env byte, no dependency-isolation rule, no
SMART/AIMS inactive posture, and no acceptance row. Rows 1 and 6 are the ones
re-evaluated against the new pin: the built-versus-served asset manifest is
recomputed at precondition 10, and the schema-wide signature map of precondition
8 remains the proof that the added surface writes nothing at rest.

## Frozen boundary

- Incumbent release recorded in `docs/plans/live-state.md`:
  `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74` at
  `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918`.
- Rollback release: that exact incumbent, whose startability was repaired and
  proven on 2026-09-20 by `PRISMA-CLIENT-REPAIR-C01`. The additional recorded
  fallback `f0d65a531e34ded9d8148a1c3f7bf5ddbf2eec4a` reaches the repaired client
  through `4ce73d157f9a` and is no longer excluded by that defect, but it is **not
  the designated rollback**: preserve it untouched and do not substitute it.
- Do-not-retire rollback dependencies: the incumbent's server `node_modules` is a
  junction to
  `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\atlas-server\node_modules`
  (the repaired generated client), and the incumbent's client `node_modules` is a
  junction to `E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules`; that
  worktree backs the incumbent host build.
- Ports: server `5001`, production host `5174`. Port `5175`, unrelated processes,
  companion runtimes, and Tailscale Serve are forbidden.
- Durable environment file: `D:\ATLAS-runtime-config\atlas-server.env` — read key
  names/hash only; change no byte.
- Build input: preserve the currently accepted EnrollPro origin. Do not define
  `VITE_SMART_SSO_START_URL` or `VITE_AIMS_SSO_START_URL` in this release.
- Build dependencies must be isolated inside the target release. Dependency
  junctions/symlinks and installs through a shared dependency tree are forbidden.

## Preconditions — fail closed

1. Run from an elevated Administrator executor. Re-read `origin/main:AGENTS.md`.
2. Re-fetch `origin/main`; require the target SHA to exist and the build worktree
   to be clean. A later main tip does not silently replace this pin.
3. Reproduce the incumbent task action, working directory, SYSTEM/ONSTART/PT0S/
   IgnoreNew properties, machine `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA`, supervisor PID, child PIDs, listener owners, local
   health/ready, host health, Tailnet health, durable-env hash, and key-name set.
   Any divergence from `docs/plans/live-state.md` is a STOP for replanning.
4. `D:` currently has about 23.31 GiB free, below the 25 GiB warning threshold.
   Before building or installing, calculate the incumbent release's real disk
   footprint and prove the completed install leaves at least 15 GiB free. If that
   cannot be proven, STOP; this packet does not authorize deleting releases,
   worktrees, PostgreSQL data, backups, or logs.
5. Prove the incumbent has its built server, production host, dependencies, Git
   identity, and runtime CLI required for rollback.
6. Export the existing task XML to an operator-only `%TEMP%` path and record its
   SHA-256. Capture its principal, trigger, execution time limit, multiple-instance
   policy, action, arguments, and working directory as separately comparable
   fields. Preserve the original XML for symmetric rollback.
7. Record the system-scope Git `safe.directory` list. It currently contains the
   wildcard `*`, so satisfy this gate with the wildcard and add nothing. Only if
   the target path is genuinely absent and no wildcard exists does the approval
   below permit adding that one path at system scope; no user-scope entry is
   sufficient for the SYSTEM task. Record whether the entry was pre-existing, added
   by this action, or covered by the wildcard.
8. Capture a schema-wide read-only database signature map. Enumerate every
   `public` base table from `information_schema.tables`, ordered by table name;
   for each safely quoted table compute `(rowCount, signature)` where `signature`
   is `md5(string_agg(md5(row_to_json(t)::text), '' ORDER BY
   md5(row_to_json(t)::text)))`, using `md5('')` for an empty table. Store only
   table names, counts, and hashes. This includes `_prisma_migrations`, audit,
   login/account, companion-code, Teaching Load, generation, publication, and
   term-authority tables without relying on an incomplete hand-picked list.
9. Construct the release before touching 5001/5174:
   - create a clean checkout at the exact target SHA;
   - run locked `npm ci` independently in the release root, `atlas-server`, and
     `atlas-client`; do not reuse a dependency junction or run an install through
     a shared tree;
   - provide `DATABASE_URL` only in the child environment and never print it;
     from `atlas-server`, run `npm exec prisma generate -- --schema
     ..\prisma\schema.prisma`, require
     `atlas-server/node_modules/.prisma/client/index.js`, and run a built-runtime
     import smoke that loads the generated Prisma client successfully;
   - run server TypeScript/build and client TypeScript/build, with exactly
     `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and with SMART/AIMS
     start URLs unset;
   - from `atlas-client`, run `npx tsx --test
     src/lib/__tests__/companion-config.test.ts` and require SMART and AIMS to
     render as disabled plain text with no `href` when those URLs are absent;
   - smoke the built Node server and production host on alternate ports. The
     built server must start successfully; type-check/build alone is insufficient.
10. From built `atlas-client/dist/index.html`, record every referenced JS asset
    basename and SHA-256. At least one newly built asset must be referenced; this
    manifest is the served-artifact identity used by acceptance row 6.

## Authorized mutations

Only these mutations are authorized, and each may begin only after its preceding
fail-closed checks pass:

1. create the target release directory at the exact pinned Git SHA;
2. if absent, add only that exact release directory to system-scope Git
   `safe.directory` so the registered SYSTEM task can verify the product pin;
3. quiesce only the incumbent supervisor process tree and its 5001/5174 children;
4. update machine-scope `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA` to the target;
5. create a replacement task XML from the captured original by changing only the
   action path/arguments and working directory to the target, then register it
   with `schtasks /Create /F /TN "\\ATLAS-Runtime-Supervisor" /XML <temp>`;
   re-export and field-compare the task, failing unless SYSTEM, ONSTART, PT0S,
   IgnoreNew, and every non-action property are preserved; and
6. start the replacement only through
   `schtasks /run /tn "ATLAS-Runtime-Supervisor"`.

Remove every temporary task XML after its recorded hashes are captured. The
operator-only original XML capture may be retained only until post-action QA or
rollback is terminal, then must be removed.

Do not start a resident runtime from the executor shell. Stop the exact incumbent
supervisor tree first, invoke its supported `cli.mjs stop` with the incumbent
machine values supplied in that child environment, wait at least ten seconds,
prove 5001/5174 are free, and require the task no longer to be `Running` before
re-pointing. After registration, require the task to be `Ready` before the single
`schtasks /run` invocation.

## Acceptance — 8 mandatory rows

1. **Release:** installed HEAD, machine release SHA, task action/working directory,
   and supervisor status all identify the target pin and directory. Read the
   installed release from supervisor-state `releaseSha`; the supervisor's
   `productPin` field is historical (`d44f29e0`) and is not evidence for this row.
2. **Ownership:** exactly one listener owns each of 5001 and 5174; both descend
   from the task-launched supervisor and survive the invoking shell's exit.
3. **Health:** local server health and readiness, production-host live/ready,
   Tailnet health, and a DB-backed public subjects read all return 200.
4. **Public term truth:** a public published-schedule read with an explicit valid
   `termIndex` is non-5xx and contains only that resolved term; malformed term
   input returns typed `400 INVALID_TERM_INDEX`.
5. **Warning protection:** unauthenticated latest and run-specific violation
   report routes return 401 before service dispatch. No authenticated login is
   authorized in this action; same-school/cross-school live rows remain a later
   serialized browser/API acceptance, not a deployment failure.
6. **Client and served-artifact identity:** the Tailnet login/public shell renders
   without a React crash. Fetch its HTML and every referenced JS asset; require
   asset basenames and byte SHA-256 values to equal the built-dist manifest from
   precondition 10. The served assets contain the EnrollPro origin and neither a
   SMART nor AIMS SSO start URL. The pre-stop production component control proves
   both absent peers render as disabled plain text with no `href`. No claim is
   made for protected-page UX.
7. **Configuration:** durable-env bytes and key-name set are unchanged;
   `ROLLOVER_AUTO_SYNC_ENABLED=false`; no SMART/AIMS secret or URL was invented.
8. **Inactive SMART/AIMS and zero data mutation:** unauthenticated GETs to
   `/api/v1/auth/sso/smart/start` and `/api/v1/auth/sso/aims/start` each return
   typed `503 COMPANION_SSO_NOT_CONFIGURED`; neither returns a redirect or
   `Set-Cookie`. The schema-wide signature map is byte-identical before/after,
   including companion-code tables. Runtime logs and supervisor state files are
   expected operational artifacts, not database writes.

Fresh independent post-action QA must reproduce rows 1–8. `ACCEPT_READY` requires
8/8 passed, 0 blocked, 0 unperformed. The protected authenticated rows explicitly
deferred in row 5 are outside this action's mandatory count.

## Rollback

On any mandatory failure after quiescence, stop the target supervisor tree using
the same sequence; restore both machine variables and register the exact captured
incumbent XML; require its SHA-256 and comparable fields to match the pre-action
capture; remove the exact system-scope `safe.directory` entry only if this action
added it; require the restored task to be `Ready`, relaunch through that task, and
reproduce ownership, health, readiness, Tailnet, durable-env, and schema-wide DB
signature invariants. Retain evidence of the failed target. Do not improvise a
manual resident process.

## Exact approval sentence — granted 2026-09-20 (delegated); execution gated on the bounded re-review of this revision

> I approve HIGH action CURRENT-SOURCE-LIVE-DEPLOY-C01: from an elevated Administrator executor, create an isolated release for ATLAS source `7499916886707c35ea708a17ef7a87e791a6bade` at `D:\ATLAS-runtime-supervised-74999168-20260920`, using locked independent dependency installs, Prisma client generation from `atlas-server` against the repository-root schema, and a client build with exactly `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` while SMART/AIMS start URLs remain unset; if required for the registered SYSTEM task, add only that exact release path to system-scope Git `safe.directory`; after every packet precondition and alternate-port smoke passes, replace only the supervisor-owned ATLAS processes on ports 5001 and 5174 by changing only the captured `ATLAS-Runtime-Supervisor` task action/working directory through a property-preserving XML registration, re-pointing the two machine source/release variables, and starting it only through the registered SYSTEM task; preserve the durable environment file byte-for-byte, keep rollover automation disabled, perform no login or database write, and stop before migration, Teaching Load apply, generation, publication, rollover, or companion-repository action; require exact served-client artifact hashes, typed inactive SMART/AIMS 503 responses, and an unchanged schema-wide database signature; on any mandatory failure, symmetrically restore the captured incumbent task XML and machine variables, remove the exact system safe-directory entry only if this action added it, relaunch incumbent release `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`, and prove its ownership, health, and unchanged data state.

## Return

Return one concise evidence artifact with the exact before/after task fields and
XML hashes, machine fields, system safe-directory delta, PIDs/listeners, disk
proof, dependency/Prisma/build/smoke results, built-versus-served asset manifest,
rows 1–8, schema-wide database signatures, rollback status, and immutable
evidence SHA. Do not paste logs, secrets, database rows, or environment contents.
