# ENROLLPRO-PROXY-RECOVERY-LIVE-2026-09-14 — prepared HIGH live-recovery packet

Status: **SUPERSEDED 2026-09-20 — DO NOT EXECUTE. Two premises of this packet are
now false.** (1) Its accepted-source binding would install release `54dce67b…` and
declare that as `ATLAS_RUNTIME_RELEASE_SHA`; the live release is now
`7499916886707c35ea708a17ef7a87e791a6bade`, so executing it verbatim would
**downgrade the runtime and undo the 2026-09-20 deployment**. (2) Its section 3
snapshot records `ENROLLPRO_PROXY_ORIGIN` as absent from the durable env file; that
key is now present, and the deployed runtime already resolves it in
`ops/runtime/lib/enrollpro-origin.mjs` and `cli.mjs`. The proxy's remaining 502 is
an upstream condition — the EnrollPro tailnet peer `dev-jegs` (`100.120.169.123`)
is offline — not an ATLAS configuration defect. See
`docs/handoffs/enrollpro-dev-jegs-unreachable-2026-09-20.md`. The approval sentence
in section 8 must **not** be granted and no part of this packet may be executed.

Risk: **HIGH — shared-runtime environment change + release install + supervised
process restart on ports 5001/5174.** Prepared 2026-09-14 (Asia/Manila) by the
primary planner after source integration of `ENROLLPRO-PROXY-RECOVERY-C01`.

Canonical directive: tracked `origin/main:AGENTS.md` (identical to the local root
copy), LF-normalized SHA-256
`CFA7BFABF3B05A9FEDC2FC98B632A3A6A3823C5E7E68E0F10D92594D8AB1E7E4` (verified
2026-09-14 at `origin/main` `47582013`; the directive advanced during the cycle —
re-read the root file at execution and carry the then-current hash in every
handoff).

## 1. Objective

Restore the ATLAS-hosted EnrollPro proxy (`/enrollpro-api/...`,
`/enrollpro-uploads/...`) by giving the supervised production host one explicit
durable HTTPS EnrollPro origin and installing the accepted
`ENROLLPRO-PROXY-RECOVERY-C01` release, then restarting only the
supervisor-owned ATLAS processes on 5001/5174 and proving the acceptance matrix
in section 6. This is a configuration/release/restart repair; it is not an
EnrollPro outage repair and it authorizes no database, Teaching Load, term-cache,
generation, or publication action.

## 2. Accepted source binding

- Deployed release (exact product tree): `54dce67b8392cbce09aa810813c37f9c87a67159`
  (`fix(runtime): honor durable EnrollPro proxy origin`), integrated by merge
  `bc61ecd5` over `24567e21` and pushed to `origin/main`.
- The runtime release is the product tree at `54dce67b`; documentation commits
  above it on `origin/main` are not part of the runtime artifact.
- Reviewed ancestor pin `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` must remain an
  ancestor of the deployed HEAD (`ATLAS_RUNTIME_RELEASE_SHA`).
- The execution preflight MUST verify `git -C <newReleaseDir> rev-parse HEAD ==
  54dce67b8392cbce09aa810813c37f9c87a67159` and declare
  `ATLAS_RUNTIME_RELEASE_SHA=54dce67b8392cbce09aa810813c37f9c87a67159`.

## 3. Prepared-time live snapshot (read-only, 2026-09-14 ~13:30 +08)

Every value below is a preparation-time observation and a revalidation input,
not an execution assumption: re-probe each value at execution preflight,
re-capture the live incumbent identity before any mutation, and STOP and report
if the live identity is inconsistent with this packet's binding (release, env
file, task ownership/action, or host reachability) instead of silently adopting
a drifted replacement.

- Listeners: `5001 → PID 19448`, `5174 → PID 10880`, both children of
  `node.exe` PID 3132 (the resident supervisor).
- Supervisor state file
  `D:\ATLAS-runtime-supervised-3d916b26-20260912\ops\runtime\logs\supervisor-state.json`:
  `state=running`, `releaseSha=3d916b261d6a2db71b153558ac8c2d151e2fccd0`,
  `productPin=d44f29e0…`, `sourceDir=D:\ATLAS-runtime-supervised-3d916b26-20260912`,
  `ownedPids={server:19448, client:10880}`.
- Durable environment file `D:\ATLAS-runtime-config\atlas-server.env`:
  13 keys, `ENROLLPRO_API` present, `ENROLLPRO_PROXY_ORIGIN` **absent**,
  size 2290 bytes, last write 2026-09-07T00:52:40.
- Probes: local `/api/v1/health` 200; local `/api/v1/health/ready` 200; host
  `/__host/live` 200; host `/__host/ready` first probe
  `503 {"code":"DEPENDENCY_NOT_READY", "status 0}` then 200/200 (transient
  readiness blip — acceptance requires two consecutive 200s); Tailnet
  `https://njgrm.buru-degree.ts.net/api/v1/health` 200; Tailnet
  `/enrollpro-api/settings/public` **502**; direct
  `https://dev-jegs.buru-degree.ts.net/api/settings/public` 200; direct
  `/api/integration/v1/health` 200.
- Task identity: non-elevated `schtasks /query /tn "\ATLAS-Runtime-Supervisor"`
  returns `Access is denied`; the execution preflight MUST capture the task
  definition with the rights required by the approval. Legacy
  `\ATLAS-DevServer-Temp2` remains `Disabled` (verified read-only);
  `\ATLAS Daily Backup` exists and is unrelated.

## 4. Exact switch set (nothing else may change)

**Launch ownership (durable resident owner — mandatory; directive
`AGENTS.md` §Mechanical Cycle Closure And Runtime Launch Ownership).** The
replacement resident supervisor MUST be launched by the registered Windows
task — never as a child of an attached executor shell, terminal, or temporary
wrapper. The same task is the rollback launch owner:

```yaml
launchOwner:
  type: WINDOWS_SCHEDULED_TASK
  taskName: ATLAS-Runtime-Supervisor
  principal: SYSTEM

launchMechanism:
  command: schtasks /run /tn "ATLAS-Runtime-Supervisor"
  requirement: task action and working directory point to release 54dce67b

rollbackLaunchOwner:
  type: WINDOWS_SCHEDULED_TASK
  taskName: ATLAS-Runtime-Supervisor
  principal: SYSTEM

rollbackLaunchMechanism:
  command: schtasks /run /tn "ATLAS-Runtime-Supervisor"
  requirement: task action and working directory restored to release 3d916b26
```

- The task definition (principal, trigger/delay, multiple-instances policy,
  action, working directory) is captured at preflight with the rights this
  approval grants, and is a revalidation input: if the captured incumbent
  definition is inconsistent with §3/§4.4, STOP and report before re-pointing.
- Preserved registration properties: principal `SYSTEM`, trigger `ONSTART`,
  delay `PT0S`, multiple-instances policy `IgnoreNew`; only the action and
  working directory change to the new release.
- The executor MUST NOT invoke `<newRelease>\ops\runtime\cli.mjs start` from its
  own shell. `schtasks /run /tn "ATLAS-Runtime-Supervisor"` is the only
  authorized start invocation for the forward path and for rollback.

1. **Environment backup.** Copy `D:\ATLAS-runtime-config\atlas-server.env` to an
   operator-only backup path outside every Git worktree (record absolute path,
   file size, and SHA-256; never print or commit any value).
2. **Two environment keys, exactly.** In
   `D:\ATLAS-runtime-config\atlas-server.env`:
   - add `ENROLLPRO_PROXY_ORIGIN=https://dev-jegs.buru-degree.ts.net`
   - change `ENROLLPRO_API` to `https://dev-jegs.buru-degree.ts.net/api`
   No other key may be added, removed, or modified. Before the `ENROLLPRO_API`
   change, verify server contract parity from source: the server consumes
   `${ENROLLPRO_API}/...` paths (see
   `atlas-server/src/services/enrollpro-term-contract.service.ts`,
   `enrollpro-rollover.service.ts`, `faculty-adapter.ts`) and the current value
   is an origin + `/api`; the new value preserves that shape. The
   `ENROLLPRO_PROXY_ORIGIN` value must be the bare origin (no path).
3. **Release install.** Create/verify the release directory
   `D:\ATLAS-runtime-supervised-54dce67b-20260914` containing a clean checkout of
   the exact release `54dce67b` with built artifacts:
   `atlas-server/dist` (from `npm run build` = `tsc`) and
   `atlas-client/dist` (from `npm run build` = `vite build`; a Vite dev/HMR tree
   is rejected by `assertProductionArtifact`). **The client build MUST be given
   the explicit companion origin as a build-time input:
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`** (Vite bakes it
   into the bundle; machine/user env is empty and the candidate removed the
   raw-IP defaults, so building without it would silently drop the reciprocal
   "Back to EnrollPro" link and leave the Integrated Systems EnrollPro row
   disabled). Never use a raw-IP or other school-specific value.
   `VITE_ENROLLPRO_SSO_START_URL` is not required — the reverse start derives as
   `${VITE_ENROLLPRO_URL}/api/auth/companion-sso/atlas/reverse/start`. Never
   install unbuilt or dev output. Do not modify the incumbent release directory
   `D:\ATLAS-runtime-supervised-3d916b26-20260912`.
4. **Supervisor boundary re-point.** Update the machine-level
   `ATLAS_RUNTIME_SOURCE_DIR` to the new release directory and
   `ATLAS_RUNTIME_RELEASE_SHA` to `54dce67b…` (the same scopes currently used),
   and re-point the `ATLAS-Runtime-Supervisor` task action **and working
   directory** to `D:\ATLAS-runtime-supervised-54dce67b-20260914` (both must
   name the new release; the task is the durable launch owner). Keep the task
   registration otherwise unchanged (ONSTART, `PT0S`, SYSTEM, IgnoreNew) and
   keep `ATLAS_RUNTIME_ENV_FILE=D:\ATLAS-runtime-config\atlas-server.env` and
   the existing log-directory setting. Elevation is expected for this step and
   for the task query/run in step 5.
5. **Restart only supervisor-owned 5001/5174 (quiesce + durable relaunch).**
   1. record incumbent identity (supervisor PID/tree, children, state file) —
      live revalidation, not assumption;
   2. `node <oldRelease>\ops\runtime\cli.mjs stop` (kills only owned PIDs);
   3. terminate the resident supervisor process tree (documented quiesce
      correction: an out-of-process `stop` cannot durably quiesce the resident
      supervisor) and wait at least 10 seconds for port release;
   4. confirm 5001/5174 have no listener; if any unknown listener remains, STOP
      and report (never broad-kill);
   5. re-capture the re-pointed task definition as evidence (action + working
      directory + preserved properties), then launch the replacement resident
      supervisor through the durable owner:
      `schtasks /run /tn "ATLAS-Runtime-Supervisor"`. The new launch gate
      requires `ENROLLPRO_PROXY_ORIGIN`; if the task-launched supervisor fails
      closed with `ENROLLPRO_PROXY_ORIGIN_MISSING`, do not bypass it: fix the
      environment or roll back. The launched supervisor must not be a descendant
      of the invoking executor shell;
   6. prove durable ownership and survival per §6 rows 12–13: exactly one child
      per port 5001/5174 matching supervisor state, health/readiness 200, and
      the same supervisor PID on a later re-probe from a new shell.
6. **Keep `ROLLOVER_AUTO_SYNC_ENABLED=false`** (contract invariant, unchanged);
   do not trigger rollover automation.

## 5. Exclusions (hard)

Port 5175, any unrelated process, Tailscale Serve configuration, EnrollPro/AIMS/
SMART runtimes, databases/migrations/seed/schema commands, any login
authenticated session, term-cache capture or apply, Teaching Load/suggestion/
carry-forward apply, generation, publication, any other environment key, any
other Windows task, and any repository commit/push beyond this prepared packet.

## 6. Acceptance matrix (all rows mandatory; report each PASS/FAIL with evidence)

1. Local `GET /api/v1/health` 200 and `GET /api/v1/health/ready` 200.
2. Host `GET /__host/live` 200 and two consecutive `GET /__host/ready` 200
   (first-probe transient blips must be re-probed, not assumed).
3. Tailnet `GET https://njgrm.buru-degree.ts.net/api/v1/health` 200.
4. `GET https://njgrm.buru-degree.ts.net/enrollpro-api/settings/public` 200 with
   response-body parity to direct
   `https://dev-jegs.buru-degree.ts.net/api/settings/public` (same JSON payload;
   compare canonicalized bodies).
5. `/enrollpro-uploads/...` reachability: a request must NOT return 502; a
   200/404 pass-through from the upstream is acceptable (record status + the
   exact path used, e.g. a logo path from the settings payload if present).
6. Continuity: SPA `GET /` 200 (built index) and an ATLAS API call 200.
7. Ownership: exactly one owner per port (5001/5174) equal to the new
   supervisor's recorded PIDs; supervisor state `running` with
   `releaseSha=54dce67b…`; `git -C <newReleaseDir> rev-parse HEAD` equals it.
8. Rollover automation remains disabled (contract invariant; no rollover log
   activity).
9. Logs: new bounded/redacted logs under the release log directory contain no
   secrets; no unbounded console noise.
10. Database delta: `audit_logs` count and `_prisma_migrations` count unchanged
    before vs after; no login occurred; no other write.
11. Companion-navigation build parity (no login): the built client bundle served
    by the host (resolve the JS asset referenced by `GET /`) must contain
    `dev-jegs.buru-degree.ts.net` as the companion base and must contain neither
    `100.88.55.125` nor `100.120.169.123`. The configured-base resolution
    (`${base}/dashboard`, `${base}/personnel/login`, reverse start) is covered
    by the committed client tests (23/23); the rendered authenticated
    confirmation belongs to a later login-authorized session and is NOT part of
    this packet.
12. Durable launch ownership: the task definition captured at execution shows
    principal `SYSTEM`, trigger `ONSTART` (`PT0S`), multiple-instances policy
    `IgnoreNew`, and task action + working directory pointing to
    `D:\ATLAS-runtime-supervised-54dce67b-20260914`; the resident supervisor
    owning 5001/5174 was started via `schtasks /run /tn
    "ATLAS-Runtime-Supervisor"` and is not a descendant of the invoking executor
    shell.
13. Post-shell survival: after the invoking shell/session has returned, a
    re-probe from a later shell shows the same supervisor PID owning 5001/5174
    with `GET /api/v1/health` 200 and `GET /api/v1/health/ready` 200.

## 7. Rollback (per stage, symmetric with §4)

- Environment stage: restore the section-4.1 backup file byte-for-byte.
- Release/restart stage (uses the same durable owner and launch mechanism as
  the forward path):
  1. quiesce the new-release supervisor exactly as in §4.5 (owned `cli.mjs`
     stop → resident tree termination → confirm 5001/5174 have no listener;
     never broad-kill);
  2. restore the section-4.1 environment backup byte-for-byte;
  3. restore machine source/release variables `ATLAS_RUNTIME_SOURCE_DIR` and
     `ATLAS_RUNTIME_RELEASE_SHA` to the incumbent values recorded at preflight;
  4. re-point the `ATLAS-Runtime-Supervisor` task action **and working
     directory** back to `D:\ATLAS-runtime-supervised-3d916b26-20260912`;
  5. relaunch through the durable owner: `schtasks /run /tn
     "ATLAS-Runtime-Supervisor"` (elevation as needed; never an attached
     `cli.mjs start`);
  6. prove task identity (principal/trigger/delay/instances + action/working
     directory restored), listener ownership (exactly one child per port
     5001/5174, matching supervisor state), health and readiness
     (`GET /api/v1/health` 200, `GET /api/v1/health/ready` 200,
     `GET /__host/live` 200), and parity of the re-pointed task record with the
     preflight capture.
- Deeper fallbacks remain documented (supervised `9d293879`, non-supervised
  `d44f29e0` manual) but are not part of this packet's first-line rollback.
- Record honestly: rollback restores service continuity even though the old
  release's `/enrollpro-api` proxy remains broken (the defect this packet
  repairs). If acceptance fails and rollback is executed, the cycle closes as
  `DEPLOYED_ACCEPTANCE_INCOMPLETE`/`BLOCKED` with that exact result.

## 8. Exact proposed HIGH approval sentence (NOT GRANTED)

> APPROVE ENROLLPRO-PROXY-RECOVERY-LIVE-2026-09-14: back up
> `D:\ATLAS-runtime-config\atlas-server.env` to an operator-only path; set
> exactly `ENROLLPRO_PROXY_ORIGIN=https://dev-jegs.buru-degree.ts.net` and
> `ENROLLPRO_API=https://dev-jegs.buru-degree.ts.net/api` in that file; build
> the client with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and
> install release `54dce67b8392cbce09aa810813c37f9c87a67159` at
> `D:\ATLAS-runtime-supervised-54dce67b-20260914`; re-point
> `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA` and the
> `ATLAS-Runtime-Supervisor` task action and working directory to it; quiesce
> only the supervisor-owned ATLAS processes on 5001/5174 and relaunch the
> replacement resident supervisor only through the registered SYSTEM task via
> `schtasks /run /tn "ATLAS-Runtime-Supervisor"`, preserving ONSTART, `PT0S`,
> IgnoreNew (incumbent at preflight: supervisor PID 3132, server 19448, host
> 10880, release `3d916b26`, as re-verified and re-captured at execution
> preflight); run the packet's acceptance matrix (local/Tailnet health and
> readiness 200, public `/enrollpro-api/settings/public` 200 with
> direct-upstream parity, `/enrollpro-uploads` non-502, SPA/API continuity,
> companion-navigation build parity (configured EnrollPro origin present in the
> served bundle, retired raw IPs absent), one owner per port, task
> identity/durable-launch/post-shell-survival proof, bounded/redacted logs, zero
> database delta, no login); and on any mandatory failure roll back
> symmetrically by quiescing the new release, restoring the environment backup,
> restoring the machine source/release variables, re-pointing the
> `ATLAS-Runtime-Supervisor` task action and working directory to
> `D:\ATLAS-runtime-supervised-3d916b26-20260912`, relaunching through the same
> registered task, and re-proving task identity, listener ownership, health, and
> readiness. Excluded: port 5175, unrelated processes, Tailscale Serve,
> companion runtimes, database/migrations/data, term-cache, Teaching Load,
> generation, publication, login, and every other environment key. No database
> write is expected; the only authorized mutations are the two environment keys,
> the release install/re-point, the task action/working-directory re-point, and
> the supervised 5001/5174 restart through the registered task.

## 9. Execution record required

Return: preflight re-probe results and exact incumbent identity; the preflight
task-definition capture and the post-re-point capture (principal, trigger/delay,
multiple-instances policy, action, working directory); backup path + size +
SHA-256; the two key changes (names only); release dir + `rev-parse HEAD` +
build results (including the exact client build invocation with
`VITE_ENROLLPRO_URL` and the canonical directive hash the executor read); the
`schtasks /run /tn "ATLAS-Runtime-Supervisor"` invocation and parentage proof
for the task-launched resident supervisor; quiesce/start transcript (bounded);
acceptance matrix with per-row PASS/FAIL and raw status codes; DB before/after
counts; rollback record if used (including the symmetric task re-point and the
re-proved task identity, listener ownership, health, and readiness); explicit
statement that no excluded action occurred; and the final live identity
(supervisor PID, children PIDs, releaseSha, state).
