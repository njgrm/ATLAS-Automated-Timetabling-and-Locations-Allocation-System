# TT/TL Runtime Acceptance — 2026-09-12

Status: PREPARED — NOT EXECUTED — FINAL PRE-ACTION AUDIT REQUIRED.

**Amendment R1 (2026-09-12):** The pre-action wave audit returned
`CORRECTION_REQUIRED` on the original packet (B1: no durable release switch was
named, so the deploy could no-op or fail `RELEASE_SHA_MISMATCH`; B2: the
`d44f29e0` fallback has no `/api/v1/health/ready` and is not
supervisor-startable). This revision names the durable release switch (new
release directory + machine env + boot-task continuity) and corrects the
rollback definition. No stop, start, environment change, or task change may
occur until the operator returns the revised exact approval sentence in
section 8 and the pre-action audit trail clears this revision (see the R2 note
below).

**Amendment R2 (2026-09-12):** Primary-planner validation found that R1
permitted the cutover before proving the reusable authenticated session, which
could downgrade a mandatory acceptance row only after deployment — prohibited
by project rule. R2 requires the authenticated-session preflight (Required
preflight step 5) to pass **before any listener stop, machine-environment
change, or task change**; if it cannot pass, this packet stops with no
deployment. R2 also clarifies that health payloads do not expose `releaseSha`.
Round-2 pre-action re-audit `ses_f6a60dc69ffeLSEf0CUPZUTEwv` verified the R1
packet mechanics (B1/B2 resolved); it did not review the later R2 boundary.

**Amendment R3 (2026-09-12):** Head-planner validation rejected the R2 claim
that the audit budget could waive final independent review. It also found that
R2 proved only point-in-time executor authentication and did not assign the
same session to the fresh QA role or prove sufficient token lifetime. Before
HIGH approval may be requested, one fresh pre-action auditor must validate the
final R3 packet. During execution, the primary planner shall start the fresh
independent QA/session custodian before the executor, and the exact retained
browser context shall own all authenticated acceptance rows.

**R3 final-audit outcome (2026-09-12):** The fresh final audit
(`ses_f6a0e829bffeYKI1HEUwT13EjU`) returned `CORRECTION_REQUIRED` (F1: the
resident supervisor relaunches children killed by an out-of-process `cli.mjs
stop`, so the stop/rollback sequence was not mechanically durable). Its bounded
remedy is applied here: quiesce the resident supervisor process tree plus
`cli.mjs stop` with a released-port settle window of at least 10 seconds
(deployment step 2 and the rollback path), reflected once in section 8. One
fresh re-audit of this corrected packet is required before the approval
sentence may be presented.

## Objective

Deploy the integrated ATLAS source at `3d916b261d6a2db71b153558ac8c2d151e2fccd0`
to the supervised runtime, then perform read-only live acceptance of the new
Timetable shape diagnostics and Teaching Load authority diagnostics.

This is a source deployment and read-only acceptance only. It does not authorize
Teaching Load apply, carry-forward, generation, publication, rollover sync,
term-cache apply, migration, schema changes, or companion-repository changes.

## Current verified state

- Tailnet health: `https://njgrm.buru-degree.ts.net/api/v1/health` = 200.
- Current listeners: ATLAS owns ports 5001 and 5174 (supervised PIDs must be
  re-verified immediately before execution). Port 5175 (Vite) and the unrelated
  `tsx` processes are out of scope and must never be stopped or modified.
- Current supervised release: `9d2938791460c1d19059e5eddd30d7bba623fdad`
  (serving product pin `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`) from
  `D:\ATLAS-runtime-supervised-20260912`. Machine-scope
  `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` and the
  `ATLAS-Runtime-Supervisor` boot task currently reference that release.
- Durable env file (unchanged by this action):
  `D:\ATLAS-runtime-config\atlas-server.env` (never printed or committed).
- Legacy task `ATLAS-DevServer-Temp2` is disabled (leave as-is).
- Target source: `3d916b261d6a2db71b153558ac8c2d151e2fccd0`, contained in
  `origin/main` and descending from the current product pin.
- Rollback: the incumbent supervised release `9d293879` is kept intact for a
  supervised reset; the `d44f29e0` fallback at
  `D:\ATLAS-runtime-fallback-d44-20260912` is retained as the operator-named
  manual last resort (see "Rollback"). Never stop an unexpected listener.

## Required preflight

1. Refresh `origin/main` and verify the target SHA and ancestry.
2. Re-read the current supervisor state, exact PIDs, ports, task state, machine
   env values (metadata only), and Tailnet health. If either port is
   unexpectedly empty or owned by an unknown process, stop for replanning.
3. Build the target server and client from the exact target SHA in the new
   durable release directory (see "Deployment strategy"); verify the built
   server and client artifacts and the supervisor contract before any listener
   interruption.
4. Record secret-free before signatures. Do not print or commit environment
   contents.
5. **Authenticated-session custody preflight (mandatory, before any
   mutation).** The primary planner shall start one fresh independent QA as the
   session custodian before dispatching the elevated executor. In the configured
   persistent Playwright profile, QA shall retain the exact tab/context and
   prove that an existing authenticated officer/admin session can access the
   required school/year read-only routes at the exact origin
   `https://njgrm.buru-degree.ts.net`. Decode the JWT expiry without printing or
   persisting the token and require at least 105 minutes remaining: the action
   budget is 90 minutes plus a 15-minute safety margin. Recheck actor, school,
   route access, and remaining lifetime immediately before the planner releases
   the executor to stop the incumbent. This preflight issues no fresh login and
   no mutation request.
   - If the reusable session passes both checks, QA keeps custody of the exact
     context while the executor performs only the deployment boundary. After
     target health, the same QA context performs every authenticated acceptance
     row and then closes the context according to the QA protocol.
   - If it is absent, expired, wrong-school, or otherwise unusable, return
     `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` with **no deployment and no
     runtime/task/environment mutation**. The operator may then authorize one
     bounded login or split deployment from authenticated acceptance.

## Deployment strategy (durable release switch)

The served release is selected by machine-scope `ATLAS_RUNTIME_SOURCE_DIR` plus
`ATLAS_RUNTIME_RELEASE_SHA` (validated against the deployed tree's HEAD at
start) and by the `ATLAS-Runtime-Supervisor` boot task's action/working
directory. The deployment re-points both together to the new release so a
reboot cannot diverge from the served release. A new directory (rather than an
in-place update of the incumbent) is used so the incumbent stays intact as a
supervised rollback artifact.

1. **Build (no listener change).** Create the new durable release directory
   `D:\ATLAS-runtime-supervised-3d916b26-20260912` as a detached checkout of
   `3d916b26` (for example,
   `git worktree add --detach D:\ATLAS-runtime-supervised-3d916b26-20260912 3d916b26`
   from the main repository), provision dependencies, and build the server and
   client per `ops/runtime/README.md` / `install-preview` guidance. Verify
   `atlas-server/dist`, `atlas-client/dist`, `ops/runtime/**`, and the
   supervisor contract offline (`install-preview` / `status`, no binding).
2. **Quiesce the incumbent (resident supervisor + its children).** The live
   runtime is a *resident* supervisor process
   (`node <releaseDir>\ops\runtime\cli.mjs start`) that relaunches its children
   after bounded backoff when they exit unexpectedly, so `cli.mjs stop` alone
   cannot durably release the ports.
   (a) Identify the resident supervisor: the `cli.mjs start` process that is
   the parent of the recorded `ownedPids` on 5001/5174; record its exact PID
   and release directory.
   (b) Terminate that exact supervisor process tree **and** run
   `node ops/runtime/cli.mjs stop` from the current release
   directory/environment for its recorded children, so nothing can relaunch
   them.
   (c) Prove 5001/5174 remain released for a settle window of at least
   10 seconds (strictly greater than the supervisor's 2-second restart
   backoff) before any durable re-point. Never touch an unexpected listener.
3. **Switch durable references (authorized).** Set machine-scope
   `ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-3d916b26-20260912` and
   `ATLAS_RUNTIME_RELEASE_SHA=3d916b261d6a2db71b153558ac8c2d151e2fccd0`
   (`setx /M`, registry read-verify, never print env-file contents). Re-point
   the `ATLAS-Runtime-Supervisor` boot task action and working directory to the
   new release's `ops/runtime/cli.mjs`, preserving `ONSTART`,
   `ExecutionTimeLimit=PT0S`, `SYSTEM`, and `MultipleInstances=IgnoreNew`;
   verify via `schtasks /query /xml`. Leave
   `ATLAS_RUNTIME_ENV_FILE=D:\ATLAS-runtime-config\atlas-server.env` unchanged.
4. **Start** from the new release with the new values:
   `node ops/runtime/cli.mjs start`, invoked from a fresh process (or with the
   two variables explicitly set in the invoking process) so the re-pointed
   machine env is actually observed. Require exactly one supervisor-owned PID
   per port, local `GET /api/v1/health` 200, local `GET /api/v1/health/ready`
   200, and Tailnet `GET /api/v1/health` 200; record `releaseSha == 3d916b26…`.
5. Record secret-free status, bounded logs, and the exact installed HEAD.

## Deployment boundary

- Stop and start only the ATLAS supervisor-owned processes on ports 5001/5174.
- Authorized filesystem/environment/task changes: the new durable release
  directory and its build artifacts; machine-scope `ATLAS_RUNTIME_SOURCE_DIR`
  and `ATLAS_RUNTIME_RELEASE_SHA`; and the `ATLAS-Runtime-Supervisor` boot
  task's action/working directory. Nothing else.
- Keep `ROLLOVER_AUTO_SYNC_ENABLED=false`.
- Do not alter port 5175, unrelated processes, Tailscale configuration, the
  durable env file, or `ATLAS-DevServer-Temp2` beyond its existing disabled
  state.
- Do not claim zero downtime.

## Rollback

- **Supervised reset (preferred).** If target startup fails health or
  readiness: quiesce the target's resident supervisor and children with the
  same procedure as deployment step 2 (terminate the exact supervisor process
  tree, run `cli.mjs stop`, hold a released-port settle window of at least
  10 seconds); re-point machine env
  (`ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-20260912`,
  `ATLAS_RUNTIME_RELEASE_SHA=9d2938791460c1d19059e5eddd30d7bba623fdad`) and the
  boot task back to the incumbent release; start it from a fresh process (or
  with the two variables explicitly set in the invoking process); require local
  health and readiness 200; record the restored identity. The incumbent
  directory is kept intact for this purpose.
- **Manual last resort (`d44f29e0`, operator-named).**
  `D:\ATLAS-runtime-fallback-d44-20260912` has **no `/api/v1/health/ready`**
  and is **not** supervisor-startable. If it must be used, start it manually as
  a non-supervised degraded restore, verify only `GET /api/v1/health`, and
  record that supervisor boot continuity is intentionally inactive until a
  supervised release is restored.
- Do not use `node ops/runtime/cli.mjs rollback` as the mechanism (a new
  directory has no recorded `previous` baseline).
- If an unexpected listener appears on 5001/5174 at any point: stop for
  replanning; do not kill or adopt it.

## Read-only acceptance

After target health and readiness are 200, the designated fresh QA/session
custodian—not the elevated executor—shall perform the authenticated acceptance:

- Assert browser origin is exactly `https://njgrm.buru-degree.ts.net`.
- Use an existing authenticated session only. Do not perform a fresh login
  (login creates an audit event and is not authorized).
- At 1366x768 and 390x844, inspect Dashboard, Subjects, Teaching Load, and
  Simple Timetable. Capture route URLs, accessibility snapshots, console
  errors, network statuses, and no-write request proof.
- Call the read-only Teaching Load authority-diagnostics route with explicit
  `schoolId` and active `schoolYearId`; verify zero-write proof, HG exclusion,
  zero-load faculty visibility, adviser diagnostics, and typed blockers. This
  route accepts a scoped system token (`x-integration-key` / `ATLAS_SYSTEM_TOKEN`)
  or JWT.
- Call the read-only generation readiness/diagnostic route with shift-window
  enforcement; verify three-term authority, stakeholder shape blockers, empty
  demand/output fail-closed behavior, and no generation claim. This route
  requires an operator JWT with privileged role and actor-school scope and is
  gated by the mandatory authenticated-session preflight: the JWT-only row is
  never downgraded to `EXTERNALLY_BLOCKED` after a deployment, because an
  unusable session stops this packet before any mutation.
- Stop before any Save, Apply, Generate, Publish, rollover, or term-cache
  action.
- If the target's new diagnostics cannot be reached on the deployed release,
  report it as a finding; do not substitute the incumbent's behavior.

## Evidence and stop conditions

The elevated executor returns `REVIEW_REQUIRED` after deployment evidence. QA
then returns the mandatory tally and `ACCEPT_READY`, `CORRECTION_REQUIRED`, or
`EXTERNALLY_BLOCKED`. The cycle cannot close unless all target health, release
identity, browser origin, read-only diagnostics, and zero-write checks pass.
Report any
`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` honestly (it is a pre-mutation
stop, never a post-deployment downgrade). Do not substitute localhost for
Tailnet browser evidence.

Post-start evidence semantics (no overclaiming):
- local liveness = HTTP 200 on `GET /api/v1/health`;
- local dependency readiness = HTTP 200 on `GET /api/v1/health/ready`;
- Tailnet liveness = HTTP 200 on
  `https://njgrm.buru-degree.ts.net/api/v1/health`;
- exact installed `releaseSha` = the supervisor status output **and**
  `git -C <new release directory> rev-parse HEAD`, both equal to `3d916b26…`.
  The health payloads do not contain `releaseSha`; do not claim they do.
- quiesce evidence = the resident supervisor's exact PID + release directory,
  its recorded children, and a released-port settle window of at least
  10 seconds before any durable re-point;
- custody evidence = the dedicated release directory's filesystem owner is
  reported, and any Git `safe.directory` override is per-command and limited to
  that exact verified path.

Commit one docs-only evidence artifact under `docs/verification/` or
`docs/reviews/`; do not modify product source during acceptance.

Suggested commit:

```text
docs(runtime): record TT and Teaching Load live acceptance
```

## 8. Revised copy-ready approval sentence

> I approve HIGH action TT-TL-RUNTIME-ACCEPTANCE-2026-09-12 (amended R3): first,
> without mutation or a fresh login, let the fresh independent QA/session
> custodian retain the exact persistent Playwright tab/context at
> `https://njgrm.buru-degree.ts.net`, prove the existing officer/admin actor and
> school/year access, and verify at least 105 minutes of JWT lifetime remaining
> both at initial preflight and immediately before listener interruption; if
> that session is absent, expired, wrong-school, has insufficient or unreadable
> lifetime, or is otherwise unusable, stop before any listener, environment, or
> task change and return
> `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` with no deployment; then let the
> elevated Administrator executor build the integrated source at
> `3d916b261d6a2db71b153558ac8c2d151e2fccd0` in the new
> durable release directory `D:\ATLAS-runtime-supervised-3d916b26-20260912`;
> quiesce the resident supervisor and its owned 5001/5174 processes (terminate
> the exact `cli.mjs start` supervisor process tree and run `cli.mjs stop` from
> the current release environment, then hold a released-port settle window of at
> least 10 seconds); set machine-scope
> `ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-3d916b26-20260912` and
> `ATLAS_RUNTIME_RELEASE_SHA=3d916b261d6a2db71b153558ac8c2d151e2fccd0`, and
> re-point the `ATLAS-Runtime-Supervisor` boot task action and working directory
> to the new release's `ops/runtime/cli.mjs` while preserving ONSTART, PT0S,
> SYSTEM, and IgnoreNew and verifying via `schtasks /query /xml`, leaving the
> durable env file `D:\ATLAS-runtime-config\atlas-server.env` unchanged; start
> the new release (from a fresh process or with those variables set in the
> invoking process) and require exactly one supervisor-owned PID per port,
> local `/api/v1/health` 200, local `/api/v1/health/ready` 200, and Tailnet
> health 200, with the exact installed `releaseSha` confirmed as `3d916b26…`
> from the supervisor status and `git -C <new release directory> rev-parse HEAD`
> (not from health payloads); keep `ROLLOVER_AUTO_SYNC_ENABLED=false`; run the
> Tailnet-only read-only Teaching Load and Timetable acceptance with the
> existing session only (no fresh login) and stop before any Save, Apply,
> Generate, Publish, rollover, term-cache, Teaching Load carry-forward/
> suggestion apply, generation, publication, migration, schema, or
> companion-repository action; on failure, reset to the incumbent supervised
> release `9d293879` by
> re-pointing machine env and the boot task back and starting it with health and
> readiness 200, retaining `d44f29e0` at
> `D:\ATLAS-runtime-fallback-d44-20260912` only as a documented non-supervised
> manual last resort; never stop or modify the port-5175 Vite process or the
> unrelated `tsx` processes; never display or commit environment contents; let
> the same retained QA context perform all authenticated Tailnet acceptance
> after target health; report the dedicated release directory's filesystem
> owner (any Git `safe.directory` override is per-command and limited to that
> exact verified path); and commit exactly one docs-only evidence artifact,
> returning its commit SHA.
