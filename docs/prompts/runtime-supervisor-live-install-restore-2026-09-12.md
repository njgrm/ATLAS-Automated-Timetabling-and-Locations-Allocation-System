# RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE-2026-09-12 — HIGH Deploy-as-Restore Packet

**Status: PREPARED — NOT APPROVED.** No listener may be started, no Windows task
created/modified, no legacy-task change made, and no environment persisted until
the operator returns the exact approval sentence in section 8.

**Risk:** HIGH — shared-runtime service restoration of ATLAS server 5001 / client
5174, Windows boot-task registration, and legacy `ATLAS-DevServer-Temp2`
disposition. **There is no incumbent.** This is a deploy-as-restore, not a swap.

**Supersedes:** `docs/prompts/runtime-supervisor-live-install-correction-2026-09-12.md`
(the stop-incumbent-then-start retry). That packet's stated live precondition —
that the accepted `d44f29e0` fallback is running manually — is false. The runtime
is confirmed down. The correction packet and the original
`docs/prompts/runtime-supervisor-live-install-2026-09-12.md` must not be executed
with swap wording.

**Prepared:** 2026-09-12 (Asia/Manila) by the primary planner/executor under
`ROLE: PLANNER/EXECUTOR`, cycle
`RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE-CORRECTION-2026-09-12`. This preparation
was docs-only; no live mutation was performed.

**Revision:** R1 (2026-09-12). The R0 candidate
`2fa973e5c39112efb13d105312262e40a99e0bc7` (the first copy of this packet, which
referenced the in-worktree env source
`D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env`) is marked
`SUPERSEDED — NON_APPLICABLE` and preserved unamended for history. R1 moves the
durable `ATLAS_RUNTIME_ENV_FILE` reference outside every Git worktree to
`D:\ATLAS-runtime-config\atlas-server.env`, and adds durable-config
provisioning, ACL restriction, SHA-256 equality proof, dual-context environment
delivery, and scheduled-task read proof to the future HIGH boundary.

## 0. Confirmed starting condition (read-only, verified 2026-09-12)

- Tailnet `https://njgrm.buru-degree.ts.net` `GET /api/v1/health` returns **502**.
- **No listener exists on 5001 or 5174** — `Get-NetTCPConnection -State Listen
  -LocalPort 5001,5174` is empty (verified twice in the same session).
- Task `ATLAS-Runtime-Supervisor` is **absent**.
- Task `ATLAS-DevServer-Temp2` is present, enabled, `Ready`, on-demand, and
  **unchanged**.
- A Vite process is bound to port **5175** (PID 14268) and an unrelated
  non-listening `tsx watch src/server.ts` process (PID 31612) exists. Both are
  **out of scope**: never stop, restart, or modify them.
- Reviewed release checkout `D:\ATLAS-runtime-supervised-20260912` is at
  `9d2938791460c1d19059e5eddd30d7bba623fdad` with built
  `atlas-server/dist/server.js`, `atlas-client/dist/index.html`, and
  `ops/runtime/**`.
- `git merge-base --is-ancestor d44f29e0 9d293879` succeeds. Product diff
  `9d293879` vs `d44f29e0` is the reviewed supervision files only
  (`atlas-server/src/app.ts`, `atlas-server/src/services/health.service.ts`,
  `atlas-server/src/services/crash-handler.service.ts`) plus the root
  `package.json` supervision scripts.
- Startable fallback checkout `D:\ATLAS-runtime-fallback-d44-20260912` is at
  `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` with built `atlas-server/dist` and
  `atlas-client/dist`.
- Verified operator environment **staging source** (existence/metadata only;
  never printed):
  `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env`
  (2290 bytes, LastWrite `2026-09-07T00:52:40+08:00`). This lives inside a Git
  worktree and is **not** the durable runtime reference.
- Durable runtime environment reference (target; outside every Git worktree and
  deployed source checkout; local-only operator configuration; never staged or
  committed): `D:\ATLAS-runtime-config\atlas-server.env`. It does not exist yet
  (verified `D:\ATLAS-runtime-config` and the file are absent) and is created
  only during the future HIGH action.
- Sanitized database target (verified from the single active `DATABASE_URL` line
  of the staging source; credentials never printed):
  `localhost:5432/atlas_recovery_clean_rebuild_20260905`.
  - **Reconciliation note:** the operator approval request wrote
    `atlas_recovery_clean_rebuild_20250905` (`2025`). The named env file's active
    `DATABASE_URL` reads `atlas_recovery_clean_rebuild_20260905` (`2026`). The
    verified `2026` value is recorded here; confirm the intended target before
    execution.

**Mandatory immediate pre-execution re-verification (read-only):**

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5001,5174 -ErrorAction SilentlyContinue
```

If ANY listener appears on 5001 or 5174, **STOP and return for replanning.** This
packet has no incumbent and must never stop, adopt, or replace an unexpected
listener.

## 1. Frozen identity and scope

- Supervisor release: `9d2938791460c1d19059e5eddd30d7bba623fdad`
- Product pin served by the supervisor: `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`
- Durable source dir: `D:\ATLAS-runtime-supervised-20260912`
- Durable runtime environment file:
  `D:\ATLAS-runtime-config\atlas-server.env` (outside every Git worktree and
  deployed source checkout; local-only operator configuration; never staged or
  committed). Verified staging source:
  `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env`.
- Log dir: `D:\ATLAS-runtime-supervised-20260912\ops\runtime\logs` (contract default)
- Ports: 5001 (supervised server) and 5174 (supervised production host) **only**
- `ROLLOVER_AUTO_SYNC_ENABLED=false`
- `ATLAS_SUPERVISED=true`
- Task: `ATLAS-Runtime-Supervisor`, boot/`ONSTART`, no execution-time limit
  (`ExecutionTimeLimit=PT0S`), environment delivery proven to the task account
- Legacy task: `ATLAS-DevServer-Temp2` — disable only after supervised health and
  successful registration; final disposition recorded

**Out of scope:** the port-5175 Vite process, the unrelated `tsx` process,
PostgreSQL, EnrollPro/SMART/AIMS, Tailscale/serve, term-cache apply/sync,
Teaching Load mutation, generation, publication, migration/schema, and
companion-repository edits.

## 2. Preconditions

1. Durable release checkout at `9d293879` containing `ops/runtime/**`, built
   `atlas-server/dist`, and a production `atlas-client/dist` (verified).
2. A startable `d44f29e0` fallback artifact on disk (verified).
3. The durable environment file `D:\ATLAS-runtime-config\atlas-server.env`
   exists with the verified content and an operator/task-account + `SYSTEM` +
   `Administrators`-only ACL, and `ATLAS_RUNTIME_SOURCE_DIR`,
   `ATLAS_RUNTIME_ENV_FILE` (the durable target), and
   `ATLAS_RUNTIME_RELEASE_SHA` are delivered to both the immediate elevated
   process and the boot-task account (not yet set; delivery is step 1 of
   execution).
4. Ports 5001 and 5174 empty at execution time.
5. Legacy task inspected; not modified before supervised health.
6. No zero-downtime claim; an outage window is already in effect.

## 3. Exact sequence (deploy-as-restore)

1. **Preflight (read-only).** Re-verify 5001/5174 empty and Tailnet 502; record
   the sanitized DB target and every BEFORE signature (ports, PIDs, health,
   task state). Confirm the Vite-5175 and unrelated `tsx` PIDs are untouched. If
   a 5001/5174 listener appeared, STOP.
2. **Durable environment configuration and delivery (elevated).**
   a. Create `D:\ATLAS-runtime-config` if absent.
   b. Copy the verified staging source
      `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env`
      **byte-identically** to `D:\ATLAS-runtime-config\atlas-server.env`.
   c. Retain the verified sanitized target
      `localhost:5432/atlas_recovery_clean_rebuild_20260905`.
   d. Apply an ACL on the durable file readable only by the executing
      operator/task account, `SYSTEM`, and `Administrators`.
   e. Verify source-vs-durable **SHA-256 equality without printing either
      value** (record only a boolean).
   f. Deliver the environment to **two** contexts — never rely only on
      `setx /M` for the current process: (i) the immediate elevated process
      used to start the supervisor, and (ii) the scheduled-task process after
      reboot. Set
      `ATLAS_RUNTIME_ENV_FILE=D:\ATLAS-runtime-config\atlas-server.env`,
      `ATLAS_RUNTIME_SOURCE_DIR`, and
      `ATLAS_RUNTIME_RELEASE_SHA=9d293879...` in both.
   g. Prove the scheduled-task identity can **read** the durable file (a
      read-only existence/hash check under that identity), without displaying
      its contents.
   h. Never display or commit the file contents; record only existence, length,
      ACL summary, and the hash-equality boolean.
3. **Offline preflight in the durable dir (no binding).** Review
   `node ops/runtime/cli.mjs install-preview` and
   `node ops/runtime/cli.mjs status`.
4. **Start the supervisor** from the durable release dir:
   `node ops/runtime/cli.mjs start`. Require exactly one owned PID per port,
   local `GET /api/v1/health` 200, local `GET /api/v1/health/ready` 200, and
   Tailnet `GET /api/v1/health` 200.
5. **Register the task** `ATLAS-Runtime-Supervisor` at `ONSTART` with
   `ExecutionTimeLimit=PT0S`, proven environment delivery, and a reviewed
   action/environment; review the generated `schtasks` command without printing
   credentials.
6. **Disable `ATLAS-DevServer-Temp2` only after steps 4–5 pass**, and record its
   final disposition.
7. Record secret-free status, bounded logs, and the exact installed HEAD.

## 4. Rollback boundary

- If supervised startup fails while 5001/5174 remain empty: stop only owned
  children by exact PID, then start the recorded `d44f29e0` fallback from
  `D:\ATLAS-runtime-fallback-d44-20260912`.
- If an unexpected listener appears on 5001/5174 at any point: **STOP
  immediately for replanning**; do not kill or adopt it.
- Never stop or alter the port-5175 Vite process or the unrelated `tsx` process.
- Do not claim zero downtime; an outage window is already in effect.

## 5. Acceptance matrix

- Ports 5001/5174 were empty before start and have exactly one supervisor-owned
  PID each after.
- `ATLAS-Runtime-Supervisor` exists, `ONSTART`-triggered,
  `ExecutionTimeLimit=PT0S`, with proven environment delivery.
- Local `/api/v1/health` 200 and `/api/v1/health/ready` 200; Tailnet health 200.
- `ROLLOVER_AUTO_SYNC_ENABLED=false` and `ATLAS_SUPERVISED=true` observed.
- Legacy `ATLAS-DevServer-Temp2` disabled only after supervised health;
  disposition recorded.
- The `d44f29e0` fallback remains startable; rollback restores it on any failure.
- The port-5175 Vite process and the unrelated `tsx` process are untouched.
- No credentials or raw machine-sensitive task output enter artifacts.

## 6. Mutation exclusions (hard stop)

No listener start/stop outside 5001/5174; no kill of unrelated processes; no
login; no term-cache apply/sync; no Teaching Load mutation; no generation; no
publication; no migration/schema; no companion-repository edit; no
Tailnet/firewall change, and no registry change beyond the authorized
machine-level environment delivery in step 2. The durable-config actions in
step 2 (create directory, byte-identical copy, ACL restriction, hash check,
dual-context delivery) are the only authorized filesystem/ACL changes. The
durable environment file is local-only and must never be staged or committed.

## 7. Roles and evidence

- Execution by the elevated Administrator executor. One immutable docs-only
  evidence commit; fresh QA owns any authenticated acceptance and is not part of
  this restore packet's live execution.
- Never commit secrets, usernames, or raw task output containing machine paths
  (use the redacted inventory).

## 8. Copy-ready approval sentence

> I approve HIGH action RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE-2026-09-12:
> the shared runtime is in a confirmed outage (Tailnet 502; no process owns
> 5001/5174), so this is a deploy-as-restore with no incumbent to stop; from the
> elevated Administrator executor, create `D:\ATLAS-runtime-config` if absent
> and copy the verified source
> `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env`
> byte-identically into `D:\ATLAS-runtime-config\atlas-server.env`, retaining the
> sanitized target `localhost:5432/atlas_recovery_clean_rebuild_20260905`,
> applying an ACL readable only by the executing operator/task account, `SYSTEM`,
> and `Administrators`, and verifying source-vs-durable SHA-256 equality without
> printing values; start the reviewed supervisor at release
> `9d2938791460c1d19059e5eddd30d7bba623fdad` serving the pinned product
> `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` from
> `D:\ATLAS-runtime-supervised-20260912` on ports 5001 and 5174 only with
> `ROLLOVER_AUTO_SYNC_ENABLED=false`; set
> `ATLAS_RUNTIME_ENV_FILE=D:\ATLAS-runtime-config\atlas-server.env`,
> `ATLAS_RUNTIME_SOURCE_DIR`, and `ATLAS_RUNTIME_RELEASE_SHA` for both the
> immediate elevated process and the boot task, and prove the scheduled-task
> identity can read the durable file without displaying its contents; register
> `ATLAS-Runtime-Supervisor` at boot with `ExecutionTimeLimit=PT0S` (no limit);
> require one owned PID per port plus local `/api/v1/health` and
> `/api/v1/health/ready` 200 and Tailnet 200; disable `ATLAS-DevServer-Temp2`
> only after supervised health and successful registration; use the startable
> `d44f29e0` fallback from `D:\ATLAS-runtime-fallback-d44-20260912` on any
> failure; never stop or modify the port-5175 Vite process or the unrelated
> `tsx` process; never display or commit the durable environment file; and stop
> before login, term-cache apply/sync, Teaching Load mutation, generation,
> publication, migration/schema, or companion-repository changes.
