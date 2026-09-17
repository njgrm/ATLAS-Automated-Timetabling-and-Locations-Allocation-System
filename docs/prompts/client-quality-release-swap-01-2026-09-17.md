# CLIENT-QUALITY-RELEASE-SWAP-01 - deploy the accepted client fixes and clear the live gate

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **HIGH** - shared-runtime release swap on the supervisor-owned ports.

## Objective

Build and install a release carrying the accepted `CLIENT-QUALITY-C01` fixes, re-point and restart the supervisor-owned runtime, then run the live acceptance matrix - including the route smoke across every route - so gate **L2** passes and the live `/timetable` React #310 crash is gone.

## Why this exists

`CLIENT-QUALITY-C01` is source-accepted and integrated at `1fd4c1a6`, but its gate **L2** (every route passing on the live origin) is definitionally post-deploy and could not be recorded `ACCEPT_READY` while blocked. This lane clears it. It also removes a **live crash on the demo-critical page**.

## Immutable identity

- Accepted product tip: `ee5a2bf19c2491aa204a78e775fec98056780350` (contains the accepted candidate `1fd4c1a6`). **Re-verify and record the pin at dispatch.**
- Currently-live release (rollback target): `8eb0511baa537d4212f24a007ac40e2dded38c0e` at `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917`.
- Live acceptance origin: `https://njgrm.buru-degree.ts.net` (assert `window.location.origin` on every browser row).
- Directive: read `origin/main:AGENTS.md` and record its blob + LF-SHA-256.

## Launch ownership (required by the mechanical closure invariant)

| Field | Value |
| --- | --- |
| `launchOwner` | the registered task `\ATLAS-Runtime-Supervisor` (SYSTEM, ONSTART, `PT0S`, `IgnoreNew`) - not the invoking shell |
| `launchMechanism` | re-point the task action/working directory and the **Machine-scope** `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` to the new release, then `schtasks /run /tn ATLAS-Runtime-Supervisor` |
| `rollbackLaunchOwner` | the same registered task |
| `rollbackLaunchMechanism` | symmetric re-point back to `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` (`8eb0511baa537d4212f24a007ac40e2dded38c0e`), then `schtasks /run`, then the same health proof |

Register the new release directory in the global Git `safe.directory` list **as a declared approved action** - do not repeat the C10 record gap. Verify machine-scope variables from the registry (`[Environment]::GetEnvironmentVariable(name,'Machine')`), **never** from the session's inherited environment; `ops/runtime/cli.mjs` resolves its state path from `ATLAS_RUNTIME_SOURCE_DIR` and a pre-change shell reports the previous release.

## Preconditions (verify read-only; any failure is a STOP)

1. The accepted tip is an ancestor of the pin; the working tree is clean.
2. Rollback startability: the current live release directory has its built server entry point and dependencies intact.
3. Build and smoke the new release on alternate ports **before** stopping the incumbent.
4. Capture the incumbent identity (task fields, PIDs, listeners, health) immediately before the swap.

## Execution

1. Build and install the new release; alternate-port preflight smoke; rollback startability proof.
2. Stop only the supervisor-owned tree (`cli.mjs stop` + settle >= 10 s + verify 5001/5174 free). Never touch port 5175, unrelated processes, or Tailscale Serve.
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
| 7 | Zero mutation | before/after signatures; only the disclosed browser logins change `audit_logs` and `last_login_at` |
| 8 | Rollback available | the same-task rollback path is proven, not executed |

Browser logins are authorized under the standing browser-QA authorization: disclose each login and its expected delta, enforce the write deny-list mechanically, and never print a credential.

## Forbidden

No data mutation, generation, publication, Teaching Load apply, term-cache apply, rollover, migration, or companion change. No durable-env edit. No root lockfile. Do not touch port 5175, unrelated processes, or Tailscale Serve. No global Git setting other than the single declared `safe.directory` entry.

## Deliverable and return

One evidence document under `docs/reviews/client-quality-c01/`: the pin, the install directory, the task action/working-directory/machine-variable diff, the pre-stop pin proof, the `safe.directory` disclosure, env key-name set (unmodified), PID/listener before and after, health results, rows 1-8 with per-row PASS/FAIL, the live smoke result naming every route, the login disclosures, the zero-mutation proof, and rollback status.

Return `REVIEW_REQUIRED` with base and candidate SHAs, changed paths, the row tally, and risks. If a mandatory row fails, execute the pre-authorized rollback and report it plainly. Do not push.
