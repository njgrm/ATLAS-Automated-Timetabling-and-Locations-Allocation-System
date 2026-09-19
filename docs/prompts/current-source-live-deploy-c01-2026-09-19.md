# CURRENT-SOURCE-LIVE-DEPLOY-C01

Status: **PREPARED — NOT APPROVED**

Risk: **HIGH** — supervised shared-runtime replacement

Target source: `134bcf28b866f587f87afe8b9ba51c130d1e128b`

Target release: `D:\ATLAS-runtime-supervised-134bcf28-20260919`

Worktree disposition: `RETIRE_AFTER_INTEGRATION`

## Objective

Deploy the integrated SMART-style shared chrome, selected-term public schedule,
warning-readability/actor-scope, and direct-federation source to the supervised
ATLAS runtime. SMART and AIMS remain intentionally inactive because their peer
implementations and paired secrets do not yet exist.

This action performs no login, database write, migration, environment-file edit,
generation, publication, Teaching Load apply, rollover, or companion-repository
change.

## Frozen boundary

- Incumbent release recorded in `docs/plans/live-state.md`:
  `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74` at
  `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918`.
- Rollback release: that exact incumbent. Preserve the additional recorded
  fallback `f0d65a531e34ded9d8148a1c3f7bf5ddbf2eec4a` untouched.
- Ports: server `5001`, production host `5174`. Port `5175`, unrelated processes,
  companion runtimes, and Tailscale Serve are forbidden.
- Durable environment file: `D:\ATLAS-runtime-config\atlas-server.env` — read key
  names/hash only; change no byte.
- Build input: preserve the currently accepted EnrollPro origin. Do not define
  `VITE_SMART_SSO_START_URL` or `VITE_AIMS_SSO_START_URL` in this release.

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
6. Build the pinned server and client and smoke both on alternate ports before
   touching 5001/5174. The built Node server must start successfully; TypeScript
   or build success alone is insufficient.
7. Capture read-only database signatures for the tables touched by login, audit,
   Teaching Load, generation, publication, term authority, and migrations.

## Authorized mutations

Only these mutations are authorized after all preconditions pass:

1. create the target release directory at the exact pinned Git SHA;
2. add that exact release directory to Git `safe.directory` if required;
3. quiesce only the incumbent supervisor process tree and its 5001/5174 children;
4. update machine-scope `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA` to the target;
5. re-point only the registered `ATLAS-Runtime-Supervisor` task action and working
   directory to the target while preserving every other task property; and
6. start the replacement only through
   `schtasks /run /tn "ATLAS-Runtime-Supervisor"`.

Do not start a resident runtime from the executor shell. Stop the exact incumbent
supervisor tree first, invoke its supported `cli.mjs stop`, wait at least ten
seconds, and prove 5001/5174 are free before re-pointing.

## Acceptance — 8 mandatory rows

1. **Release:** installed HEAD, machine release SHA, task action/working directory,
   and supervisor status all identify the target pin and directory.
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
6. **Client:** the Tailnet login/public shell renders without a React crash; the
   served bundle contains the EnrollPro origin and contains neither a SMART nor
   AIMS SSO start URL. No claim is made for protected-page UX.
7. **Configuration:** durable-env bytes and key-name set are unchanged;
   `ROLLOVER_AUTO_SYNC_ENABLED=false`; no SMART/AIMS secret or URL was invented.
8. **Zero data mutation:** every captured signature is unchanged. Runtime logs and
   supervisor state files are expected operational artifacts, not database writes.

Fresh independent post-action QA must reproduce rows 1–8. `ACCEPT_READY` requires
8/8 passed, 0 blocked, 0 unperformed. The protected authenticated rows explicitly
deferred in row 5 are outside this action's mandatory count.

## Rollback

On any mandatory failure after quiescence, stop the target supervisor tree using
the same sequence; restore the incumbent task action, working directory, and both
machine variables; relaunch through the registered task; and reproduce ownership,
health, readiness, Tailnet, and durable-env invariants. Retain evidence of the
failed target. Do not improvise a manual resident process.

## Exact approval sentence — not yet granted

> I approve HIGH action CURRENT-SOURCE-LIVE-DEPLOY-C01: from an elevated Administrator executor, build and install ATLAS release `134bcf28b866f587f87afe8b9ba51c130d1e128b` at `D:\ATLAS-runtime-supervised-134bcf28-20260919`; after every packet precondition passes, replace only the supervisor-owned ATLAS processes on ports 5001 and 5174 by re-pointing the existing `ATLAS-Runtime-Supervisor` task and machine source/release variables and starting it only through the registered SYSTEM task; preserve the durable environment file byte-for-byte, keep rollover automation disabled, configure no SMART/AIMS URL or secret, perform no login or database write, and stop before migration, Teaching Load apply, generation, publication, rollover, or companion-repository action; on any mandatory failure, symmetrically restore and relaunch incumbent release `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74` and prove its ownership and health.

## Return

Return one concise evidence artifact with the exact before/after task and machine
fields, PIDs/listeners, disk proof, build/smoke result, rows 1–8, database
signatures, rollback status, and immutable evidence SHA. Do not paste logs or
environment contents.
