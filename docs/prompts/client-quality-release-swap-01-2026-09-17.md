# CLIENT-QUALITY-RELEASE-SWAP-01 - deploy the accepted client fixes and clear the live gate

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **HIGH** - shared-runtime release swap on the supervisor-owned ports.

## Objective

Build and install a release carrying the accepted `CLIENT-QUALITY-C01` fixes, re-point and restart the supervisor-owned runtime, then run the live acceptance matrix - including the route smoke across every route - so gate **L2** passes and the live `/timetable` React #310 crash is gone.

## Why this exists

`CLIENT-QUALITY-C01`'s accepted source is **integrated on `origin/main` at `1fd4c1a6`** (the independent review returned `ACCEPT_READY` on its own 18-gate set, and the merged tree is byte-identical to the reviewed candidate). Its gate **L2** (every route passing on the live origin) is definitionally post-deploy, so `record-qa-result ACCEPT_READY` was refused with `TRANSITION_ACCEPT_READY_DIRTY_GATES` and the stream stays `REVIEW_REQUIRED` with a `DEPENDENCY` blocker. This lane clears it. It also removes a **live crash on the demo-critical page**.

## Immutable identity

- Accepted product tip: `ee5a2bf19c2491aa204a78e775fec98056780350` (contains the accepted candidate `1fd4c1a6`). **Re-verify and record the pin at dispatch.**
- Currently-live release (rollback target): `8eb0511baa537d4212f24a007ac40e2dded38c0e` at `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917`.
- Live acceptance origin: `https://njgrm.buru-degree.ts.net` (assert `window.location.origin` on every browser row).
- Directive: read `origin/main:AGENTS.md` and record its blob + LF-SHA-256.

## Launch ownership (required by the mechanical closure invariant)

| Field | Value |
| --- | --- |
| `launchOwner` | the registered task `\ATLAS-Runtime-Supervisor` - principal `SYSTEM`, run level highest, trigger ONSTART, execution time limit `PT0S`, multiple-instances policy `IgnoreNew`, enabled. Not the invoking shell |
| `launchMechanism` | (a) re-point the task action to `"C:\Program Files\nodejs\node.exe" "D:\ATLAS-runtime-supervised-<pin12>-<date>\ops\runtime\cli.mjs" start`, set the task working directory to that new release root, and update the **Machine-scope** `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` to it; then (b) `schtasks /run /tn ATLAS-Runtime-Supervisor`. Record the exact new release directory at dispatch. **Preserve every other registration property** - task name and folder, principal, run level, trigger, `IgnoreNew`, execution time limit, enabled state - and record a before/after diff |
| `rollbackLaunchOwner` | the same registered task `\ATLAS-Runtime-Supervisor` |
| `rollbackLaunchMechanism` | symmetric re-point of the same task back to `"C:\Program Files\nodejs\node.exe" "D:\ATLAS-runtime-supervised-8eb0511baa53-20260917\ops\runtime\cli.mjs" start` with that release's working directory and both machine variables restored, then `schtasks /run /tn ATLAS-Runtime-Supervisor`, then the same health proof |

Register the new release directory in the global Git `safe.directory` list **as a declared approved action** - do not repeat the C10 record gap. Verify machine-scope variables from the registry (`[Environment]::GetEnvironmentVariable(name,'Machine')`), **never** from the session's inherited environment; `ops/runtime/cli.mjs` resolves its state path from `ATLAS_RUNTIME_SOURCE_DIR` and a pre-change shell reports the previous release.

## Preconditions (verify read-only; any failure is a STOP)

1. The accepted tip is an ancestor of the pin; the working tree is clean.
2. Rollback startability: the current live release directory has its built server entry point and dependencies intact.
3. Build and smoke the new release on alternate ports **before** stopping the incumbent.
4. Capture the incumbent identity (task fields, PIDs, listeners, health) immediately before the swap.

## Execution

1. Build and install the new release; alternate-port preflight smoke; rollback startability proof.
2. **Quiesce the resident supervisor tree first - `cli.mjs stop` alone is NOT sufficient.** `ops/runtime/lib/supervisor.mjs` `stop()` kills only the owned server/client children, and `onChildExit` treats an externally killed child as unexpected and **restarts it after backoff**; the C10 cutover recorded exactly that (after `cli.mjs stop` + 10 s settle, 5001/5174 were re-occupied by fresh children of the same supervisor). The canonical sequence is:
   1. capture the resident supervisor PID and its children from the live release's `ops/runtime/logs/supervisor-state.json` and the listener owners;
   2. terminate that exact supervisor process tree (`taskkill /PID <supervisor> /T /F`);
   3. run `node <current-release>\ops\runtime\cli.mjs stop` so any owned children are reaped through the supported path;
   4. hold a released-port settle window of **at least 10 seconds**;
   5. re-verify that 5001 and 5174 are free **and** that no old-release `node` process remains.
   Never touch port 5175, unrelated processes, or Tailscale Serve. The rollback must use this same sequence.
3. Re-point and start via the registered task. Never launch the runtime as a child of your own shell.
4. Verify: release identity, single listener ownership, task-launched survivorship after your shell exits, local health/ready + host + Tailnet.

## Acceptance

| # | Row | Pass condition |
| --- | --- | --- |
| 1 | Release identity | `cli.mjs status` `releaseSha` + installed HEAD equal the pin (ignore the stale `live` flags) |
| 2 | Listeners | exactly one owner per port; the owning tree is the task-launched supervisor and survives the invoking shell exiting |
| 3 | Health | local health + ready (`database: ok`), host 5174, Tailnet health all 200 |
| 4 | **L2 - route smoke, live** | the `client-route-smoke` spec passes across **every** route on the live origin with **zero** React errors - the row that was blocked, and the direct proof the `#310` crash is gone |
| 5 | `#310` specifically | `/timetable` loads with no React error and no console error |
| 6 | UX rows live | the year-change banner is dismissible, archived load is reachable in-page, the truth panel is collapsed by default, and the Dashboard Run Health card is gone |
| 7 | Zero mutation | before/after signatures across every table; **every other signature delta 0** except the complete disclosed login set below |
| 8 | Rollback available | the same-task rollback path is proven, not executed |

**Complete expected login delta (per successful login).** A successful login writes more than an audit row. The declared set is: one `audit_logs` row with action `LOCAL_LOGIN_SUCCESS`; and on `atlas_auth_accounts` - `last_login_at` advanced, `failed_login_count` -> 0, `locked_until` -> null, `faculty_id` as recorded, plus the **engine-managed `updated_at`** advance. State the login count and the actor, and require every other signature to be delta 0. A prior failed attempt, if any, adds its own account update plus a `LOCAL_LOGIN_FAILED` row and must be recorded rather than absorbed.

Browser logins are authorized under the standing browser-QA authorization: disclose each login and its complete expected delta, enforce the write deny-list mechanically, and never print a credential.

## Forbidden

No data mutation, generation, publication, Teaching Load apply, term-cache apply, rollover, migration, or companion change. No durable-env edit. No root lockfile. Do not touch port 5175, unrelated processes, or Tailscale Serve. No global Git setting other than the single declared `safe.directory` entry.

## Deliverable and return

One evidence document under `docs/reviews/client-quality-c01/`: the pin, the install directory, the task action/working-directory/machine-variable diff, the pre-stop pin proof, the `safe.directory` disclosure, env key-name set (unmodified), PID/listener before and after, health results, rows 1-8 with per-row PASS/FAIL, the live smoke result naming every route, the login disclosures, the zero-mutation proof, and rollback status.

Return `REVIEW_REQUIRED` with base and candidate SHAs, changed paths, the row tally, and risks. If a mandatory row fails, execute the pre-authorized rollback and report it plainly. Do not push.
