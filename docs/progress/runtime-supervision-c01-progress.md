# RUNTIME-SUPERVISION-C01 Progress

**Authoritative plan:** `docs/prompts/runtime-stability-wave-2026-09-12.md` §4
**Branch:** `work/runtime-supervision-c01`
**Base:** `cf9b7e6ee46606ab4aa0a4cebe8abc0369ca8ae5`
**Risk:** MEDIUM source/test (live installation remains a separate HIGH packet)

## Status

| ID | Task | Status |
|----|------|--------|
| T1 | Immutable pin + operator-owned environment reference (no secrets/worktree paths) | DONE |
| T2 | Single-owner ports, unknown-listener rejection, no broad killing | DONE |
| T3 | Production static host/proxy for `atlas-client/dist` with SPA, caching, `/api`, `/uploads`, `/enrollpro-api`, `/enrollpro-uploads`, SSE, WebSocket | DONE |
| T4 | Boot/start recovery, bounded restart/backoff, duplicate-instance prevention, survival gate | DONE |
| T5 | Distinct liveness vs dependency readiness | DONE |
| T6 | `ROLLOVER_AUTO_SYNC_ENABLED=false` pinned invariant | DONE |
| T7 | Durable timestamped bounded logs + deterministic status | DONE |
| T8 | Clean server termination on uncaught exception under supervision | DONE |
| T9 | Reversible start/stop/status/install-preview/uninstall-preview/rollback | DONE |
| T10 | Read-only legacy scheduled-task inventory + explicit supersession | DONE |

## Changed paths

- `ops/runtime/runtime-contract.json` — reviewed pin, ports, invariants, env reference, bounds.
- `ops/runtime/lib/{errors,contract,backoff,logs,listeners,state,production-host,supervisor,inventory,status}.mjs`
- `ops/runtime/{host.mjs,cli.mjs,README.md}`
- `ops/runtime/__tests__/*.test.mjs` (6 suites)
- `atlas-server/src/services/health.service.ts` (new dependency-readiness service)
- `atlas-server/src/app.ts` (`GET /api/v1/health/ready`)
- `atlas-server/src/services/crash-handler.service.ts` (supervised opt-in exit-on-uncaught)
- `package.json` (`runtime:*` scripts)

## Decisive evidence

- `node --test "ops/runtime/__tests__/*.test.mjs"` → 56/56 PASS, 0 skipped, 0 failed.
- `npm --prefix atlas-server run build` → exit 0; client `tsc --noEmit` → exit 0; `npm --prefix atlas-client run build` → exit 0.
- Isolated built-server start (`PORT=15998`, `ROLLOVER_AUTO_SYNC_ENABLED=false`, `ATLAS_SUPERVISED=true`, no DB): `/api/v1/health` 200 `{"status":"ok"}`; `/api/v1/health/ready` 503 `{"status":"degraded","checks":{"database":"error"}}`; process alive; port released after stop. Ports 5001/5174 never bound by any test.
- Crash policy: supervised child exits 1 with `[FATAL] [uncaughtException]`; unsupervised child stays alive (log-and-continue preserved).
- Isolated live lifecycle (non-live ports, disposable children): exactly one owner per port, deep-link SPA 200, readiness proxied through host returns pinned `rolloverAutoSyncEnabled:"false"` and `supervised:"true"`, both ports/processes released after stop.

## Correction round 1 (fresh QA `CORRECTION_REQUIRED` 13/15)

- **F1 (BLOCKING) fixed:** `Supervisor.rollback()` now rebuilds targets through a `targetFactory` from the restored `previous.sourceDir` before relaunch, and reports the release actually running. `cli.mjs` passes a source-dir-scoped `targetFactory` for start/stop/status/rollback.
- **F2 (NON_BLOCKING) fixed:** intentional sibling termination during a coordinated restart is marked in `intentionalExitPids` before killing and no longer enters crash accounting; `launchAndAwaitHealthy` sets `managing` so startup/coordinated exits do not recursively restart. One real crash = one restart cycle.
- Fails-first proof: temporarily reverting the F1 target rebuild → new control fails (`atlas-current/...` vs `atlas-old/...`); temporarily removing the F2 marking → failure count `2 !== 1`. Both restored; 52/52 pass.

## Correction round 2 (pre-live-install auditor: pin contract unsatisfiable)

- **Root cause:** `verifyProductPin` required `HEAD === contract.productPin`, but a commit cannot contain its own SHA, so any installable tree containing `ops/runtime/**` could never pass (`git ls-tree -r --name-only d44f29e0 -- ops/runtime` is empty).
- **Fix:** `productPin` is now the reviewed ANCESTOR milestone verified via injected `isAncestor` (`git merge-base --is-ancestor <pin> HEAD`, `ops/runtime/lib/git.mjs`); a new operator-declared `ATLAS_RUNTIME_RELEASE_SHA` must equal the resolved HEAD. State/status surface `releaseSha` distinctly from `productPin` (`state.mjs`, `supervisor.mjs`, `status.mjs`, `cli.mjs`); contract JSON/README/install-preview updated. Inventory additionally redacts `Task To Run`, `HostName`, and `Start In`.
- **Fails-first proof:** temporarily restoring equality semantics makes the REAL-git descendant control fail (`PIN_MISMATCH`, `700546d6… !== 26793e73…`); restored → 56/56 pass. Absent/mismatched release SHA and non-descendant HEAD controls assert the typed failures directly.

## Remaining risks

- The reviewed `productPin` is the ancestor milestone; the live install packet must set `ATLAS_RUNTIME_RELEASE_SHA` to the exact deployed HEAD (which must descend from the pin).
- Live installation, boot-task registration, and removal/disable of `ATLAS-DevServer-Temp2` are NOT executed by this candidate.
- The supervisor's production target map assumes `atlas-server/dist` and `atlas-client/dist` are built during release; the install packet must build first.

## Next task

Hand off to fresh QA; no further executor task in scope.
