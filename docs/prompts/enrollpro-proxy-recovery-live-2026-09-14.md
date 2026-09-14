# ENROLLPRO-PROXY-RECOVERY-LIVE-2026-09-14 — prepared HIGH live-recovery packet

Status: **PREPARED — NOT APPROVED. The exact operator approval sentence in
section 8 has NOT been granted.** No part of this packet may be executed until
the operator returns that sentence verbatim (or an explicit superset).

Risk: **HIGH — shared-runtime environment change + release install + supervised
process restart on ports 5001/5174.** Prepared 2026-09-14 (Asia/Manila) by the
primary planner after source integration of `ENROLLPRO-PROXY-RECOVERY-C01`.

Canonical directive: `D:/ATLAS/AGENTS.md`, LF-normalized SHA-256
`4949c91b5a53a571c5c56c2fcbcee8c763712ceb838d4d8d8f8e50ccc8ee76b8` (recomputed
at this packet correction 2026-09-14 after the root directive advanced mid-cycle
from `4A501E7B…DBE5007` at 12:32 +08; the source prompt's preparation-time pin
is preserved there as historical record — read the root file directly and carry
this current hash in every execution handoff).

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

Re-verify every value at execution preflight; abort if any identity changed.

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
   and re-point the `ATLAS-Runtime-Supervisor` task action to the new release
   directory if it hard-codes the old path. Keep the task registration otherwise
   unchanged (ONSTART, `PT0S`, SYSTEM, IgnoreNew) and keep
   `ATLAS_RUNTIME_ENV_FILE=D:\ATLAS-runtime-config\atlas-server.env` and the
   existing log-directory setting. Elevation is expected for this step only.
5. **Restart only supervisor-owned 5001/5174 (quiesce sequence).**
   1. record incumbent identity (supervisor PID/tree, children, state file);
   2. `node <oldRelease>\ops\runtime\cli.mjs stop` (kills only owned PIDs);
   3. terminate the resident supervisor process tree (documented quiesce
      correction: an out-of-process `stop` cannot durably quiesce the resident
      supervisor) and wait at least 10 seconds for port release;
   4. confirm 5001/5174 have no listener; if any unknown listener remains, STOP
      and report (never broad-kill);
   5. `node <newRelease>\ops\runtime\cli.mjs start` with the updated machine
      environment; the new launch gate requires `ENROLLPRO_PROXY_ORIGIN` — if it
      fails closed with `ENROLLPRO_PROXY_ORIGIN_MISSING`, do not bypass it; fix
      the environment or roll back.
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

## 7. Rollback (per stage)

- Environment stage: restore the section-4.1 backup file byte-for-byte.
- Release/restart stage: stop the new release with its own `cli.mjs stop`,
  quiesce its supervisor tree, restore the backup environment file, re-point
  `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA` (and the task action)
  back to `D:\ATLAS-runtime-supervised-3d916b26-20260912` /
  `3d916b261d6a2db71b153558ac8c2d151e2fccd0`, and start the prior release; then
  re-verify the section-3 health probes.
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
> `D:\ATLAS-runtime-supervised-54dce67b-20260914` and re-point
> `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA` and the
> `ATLAS-Runtime-Supervisor` task action to it; stop and restart only the
> supervisor-owned ATLAS processes on 5001/5174 using the registered supervisor
> boundary (incumbent at preflight: supervisor PID 3132, server 19448, host
> 10880, release `3d916b26`, as re-verified at execution preflight); run the
> packet's acceptance matrix (local/Tailnet health and readiness 200, public
> `/enrollpro-api/settings/public` 200 with direct-upstream parity,
> `/enrollpro-uploads` non-502, SPA/API continuity, companion-navigation build
> parity (configured EnrollPro origin present in the served bundle, retired raw
> IPs absent), one owner per port,
> bounded/redacted logs, zero database delta, no login); and on any mandatory
> failure roll back by restoring the environment backup and restarting prior
> release `3d916b26`. Excluded: port 5175, unrelated processes, Tailscale Serve,
> companion runtimes, database/migrations/data, term-cache, Teaching Load,
> generation, publication, login, and every other environment key. No database
> write is expected; the only authorized mutations are the two environment keys,
> the release install/re-point, and the supervised 5001/5174 restart.

## 9. Execution record required

Return: preflight re-probe results and exact incumbent identity; backup path +
size + SHA-256; the two key changes (names only); release dir + `rev-parse HEAD`
+ build results (including the exact client build invocation with
`VITE_ENROLLPRO_URL` and the canonical directive hash the executor read);
task re-point record; quiesce/start transcript (bounded);
acceptance matrix with per-row PASS/FAIL and raw status codes; DB before/after
counts; rollback record if used; explicit statement that no excluded action
occurred; and the final live identity (supervisor PID, children PIDs,
releaseSha, state).
