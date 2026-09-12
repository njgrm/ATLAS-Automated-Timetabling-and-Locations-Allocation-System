# RUNTIME-SUPERVISION-LIVE-INSTALL-2026-09-12 — Executor Handoff

**Verdict: `REVIEW_REQUIRED` (deployment attempted; task registration failed and the reviewed target was rolled back).**

This handoff records the one approved HIGH packet execution from clean executor
branch `work/runtime-supervisor-live-install-20260912`. The dirty `D:/ATLAS`
checkout was not used as an edit or deployment boundary. No authenticated
session was opened and no login audit delta was consumed.

## Immutable boundary

| Item | Value |
|---|---|
| Executor worktree | `D:/ATLAS-worktrees/runtime-supervisor-live-install-20260912` |
| Base | `60cfe3d47ed59edf58132ab584f3ff2ce5f5bf66` (refreshed `origin/main`) |
| Installed target release | `9d2938791460c1d19059e5eddd30d7bba623fdad` |
| Reviewed product pin | `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` (ancestor check passed) |
| Target durable source | `D:/ATLAS-runtime-supervised-20260912` |
| Operator environment | `<operator-local-env>` outside every worktree; required keys present, values never recorded |
| Fallback release | `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`, built artifact at `D:/ATLAS-runtime-fallback-d44-20260912` |

`git diff d44f29e0..9d293879 -- atlas-client` was empty. The only server
differences were the reviewed health/readiness, health-service, and supervised
crash-handler files; the root package difference was the reviewed `runtime:*`
script set. Both target `dist` artifacts were built successfully. The fallback
product tree matched `d44f29e0` and retained its previously built server/client
artifacts; its supervisor overlay was kept only to preserve a recorded rollback
boundary, not claimed as a supervised fallback release. The fallback generated-
client repair was read-only with respect to the database: `npx prisma generate
--schema prisma/schema.prisma` completed in the fallback checkout before its
server was started.

## Trace table

| Requirement | Production path | Negative control | Verification | Result |
|---|---|---|---|---|
| Exact release/pin and production artifacts | `ops/runtime/cli.mjs start`, `verifyProductPin`, built server/client entrypoints | Mismatched release or non-ancestor pin is rejected by the runtime suite | `git rev-parse`, ancestor check, product-byte diff, server/client builds | PASS |
| External operator environment | `loadEnvironmentReference` and child env delivery | Missing/in-tree env is rejected | External env path and key-presence check; no values emitted | PASS |
| Incumbent ownership boundary | `Get-NetTCPConnection` + exact process identity before stop | Unknown/mismatched PID would fail closed | 5001→38468 (`node dist/server.js`), 5174→38460 (Vite `--port 5174`) | PASS |
| Exact cutover stop | Exact-PID stop only | No image-wide kill or adoption | Ports 5001/5174 were empty immediately after stopping only 38468/38460 | PASS |
| Supervisor one-owner/liveness/readiness | `Supervisor.start()` target map | Unknown listener and duplicate owner controls are in the runtime suite | Target window: 5001→35744, 5174→30456; local and Tailnet liveness/readiness all 200 | PASS (transient) |
| Rollover and supervised invariants | Contract-injected child environment | Runtime suite rejects a fail-open invariant | Logs showed `ROLLOVER_AUTO_SYNC_ENABLED=false`; status exposed `ATLAS_SUPERVISED=true` | PASS (transient) |
| Durable bounded evidence | `BoundedLogger`, `supervisor-state.json` | Secret values are redacted and bounds are tested | Timestamped target log and state were created; values/paths are not copied here | PASS |
| Runtime zero-write boundary | Read-only health/proxy checks and DB signatures | No login, apply, sync, generation, publication, or migration was run | Before/after counts identical: schools 1, mirrors 2, faculty_subjects 183, generation_runs 1, published_revisions 0, TERM_CACHE_SYNC_APPLIED audits 0, migrations 2 | PASS |
| Startable rollback target | Recorded d44 artifact and external rollback record | First supervised state has no prior release; `rollback` is unavailable by design until seeded | d44 server/client artifacts were started after target failure; fallback health 200 and Tailnet root/health 200 | PASS (manual fallback) |
| Boot/start task with no execution limit | Task Scheduler registration | Access-denied registration must not be treated as success | Both S4U/highest and current-user interactive/limited ONSTART registrations returned `Access is denied`; no supervisor task exists | BLOCKED |
| Legacy disposition | `ATLAS-DevServer-Temp2` inventory | Source must not mutate task before approved health step | Before/after: exists, Ready, Enabled, on-demand only, last result 1; it was intentionally left enabled during rollback | BLOCKED/DEFERRED |
| Live SSE/WebSocket, responsive browser and authenticated acceptance | Tailnet browser/proxy and QA login footprint | Executor must not consume the single authorized login | Reserved for fresh QA; not executed by this executor | UNPERFORMED |

## Runtime identity timeline

### Before mutation

- Tailnet origin: `https://njgrm.buru-degree.ts.net`.
- Port 5001: PID `38468`, `node.exe dist/server.js`.
- Port 5174: PID `38460`, `node.exe ...vite/bin/vite.js --host --port 5174`.
- Unauthenticated Tailnet `/` and `/api/v1/health` were `200`; the old
  `/api/v1/health/ready` was `404` as expected for the pre-supervision runtime.

### Supervised target window (healthy, then rolled back)

- Supervisor parent PID `26024`; server child PID `35744`; production-host child
  PID `30456`.
- Exactly one listener owned each required port.
- Local and Tailnet `/api/v1/health`, `/api/v1/health/ready`, `/__host/live`,
  and `/__host/ready` returned `200`; readiness included a successful database
  check. Tailnet `/` returned `200` with the built SPA artifact.
- The bounded log recorded target release `9d293879...`, reviewed pin
  `d44f29e0...`, rollover disabled, and no startup crash. No secrets were
  printed.

### Rollback result

Task registration failed before any task or legacy-task mutation. The exact
supervisor parent/children were stopped by PID, the target state was persisted
as `stopped`, and the recorded d44 fallback was started:

- Port 5001: PID `28940`, cwd
  `D:/ATLAS-runtime-fallback-d44-20260912/atlas-server`, command
  `node.exe dist/server.js`.
- Port 5174: PID `40696`, cwd
  `D:/ATLAS-runtime-fallback-d44-20260912/atlas-client`, command
  `node.exe node_modules/vite/bin/vite.js --host --port 5174`.
- Fallback local/Tailnet health and root were `200`; `/health/ready` remained
  `404` because the fallback predates the reviewed readiness route.
- Final state is explicitly `EPHEMERAL_DEPLOYMENT`: d44 is a manual startable
  product fallback, not the accepted supervised operational endpoint.

## Task and legacy disposition

The task `ATLAS-Runtime-Supervisor` is absent after the failed registration.
Failure classification: `TASK_REGISTRATION_ACCESS_DENIED`.
The legacy `ATLAS-DevServer-Temp2` inventory is unchanged (`Ready`, enabled,
on-demand only, last result `1`). No deletion, disable, registry, firewall,
Tailnet, companion-repository, schema, migration, rollover, Teaching Load,
generation, publication, or authenticated action occurred.

## Mandatory gate tally

The packet's inherited pre-install audit remains `AUDIT_CLEAR 14/14` (capsule
`ses_f6b5175c6ffejlywhgblmX7c5k`). That audit is not being relabeled as live
post-install acceptance. The executor's concrete execution gates below are
reported separately from that 14/14 pre-install audit:

`12 total / 9 passed / 2 blocked / 1 unperformed`.

The blocked gates are durable ONSTART task registration/no execution limit and
the post-health legacy-task disposition. The unperformed gate is the fresh-QA
live browser/authenticated SSE/WS/responsive matrix. The transient target health
does not waive these blockers.

## Fresh QA reservation

Fresh QA must independently review this commit range and, only after a revised
approved task-registration path exists, verify: one owner per port plus an
unknown-listener fail-closed control; restart/backoff, supervised crash, corrupt
state, and give-up behavior; boot/start recovery with an explicit zero execution
limit; SPA/static/proxy/SSE/WebSocket parity; both viewports with the exact
Tailnet origin assertion; the final legacy disposition; and authenticated C2–C8
rows with the single pre-authorized login footprint and zero unauthorized DB
writes. Executor evidence above is not acceptance authority.

## Changed paths

- `docs/handoffs/runtime-supervisor-live-install-20260912-executor.md`

No other path in this executor worktree is changed.

`REVIEW_REQUIRED` — do not merge, push, or self-approve this candidate.
