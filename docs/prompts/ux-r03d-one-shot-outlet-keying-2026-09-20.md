# UX-R03d — one-shot: stop the timetable workspace remounting on its own child routes

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization
(`AGENTS.md` §13). One cycle: one behavioural source change, deployment, browser
acceptance with QA custody.

Risk: **MEDIUM** source (app-shell routing key) with **HIGH** deployment.

Base: the `origin/main` tip in the dispatch prompt. Incumbent and rollback basis: the
release that is live when the executor starts (expected `c93dd2ee…`).

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Why this packet exists

`UX-R03a`/`R03b` split the timetable into child routes so the review workspace would stop
being torn down on every sub-page switch. Independent browser QA then **falsified** that
claim: `AppShell.tsx:566` and `:574` key the route outlet by
`` `${location.pathname}:${routeEpoch}` ``, so **every** `/timetable/*` pathname change
unmounts and remounts the whole route subtree. The data layer survives (the query cache
is module-level, and zero new requests were measured), but component state, scroll
position and selection are lost on each switch — which is the half of the route split's
intent that is still missing.

The planner's own C02 browser row claimed the opposite and has been withdrawn; this
packet fixes the cause rather than the claim.

## 2. The source change (the only behavioural work in this cycle)

1. Extract the outlet key into a pure, testable helper — for example
   `resolveOutletKey(pathname, routeEpoch)` — and use it at both `AppShell.tsx:566` and
   `:574`.
2. **Collapse the key inside the `/timetable` subtree only.** `/timetable` and each of
   `/timetable/policies`, `/timetable/pre-generation`, `/timetable/map`,
   `/timetable/manual-edit`, `/timetable/building`, `/timetable/exports` must produce the
   **same** key, so the workspace is not remounted as the operator moves between them.
3. **Keep `routeEpoch` in the key.** It exists deliberately; find every `setRouteEpoch`
   caller first and confirm its remount semantics still hold. Do not remove or repurpose
   the epoch.
4. **Byte-identical for everything else.** For every path that is not under `/timetable`,
   the key must equal today's `${pathname}:${routeEpoch}` exactly. Other pages' sub-routes
   (for example `/subjects` and `/subjects/requirements`) must keep remounting as they do
   now. This is a scoped fix, not a router redesign: do not touch route definitions,
   loaders, guards, or any other page.
5. Add a focused test pinning: the seven timetable paths share one key; a representative
   set of non-timetable paths (including a page with a sub-route) still yields
   `${pathname}:${routeEpoch}`; and changing `routeEpoch` changes the key.

## 3. Carried item — the header export control (no code change expected)

`UX-R03c` row 18 was left unperformed: the header's own export control was never
exercised because rapid sequential child-route loads intermittently failed to mount the
workspace. Verify it now in the browser, read-only, persisting nothing. If it is
genuinely broken, report it as a finding rather than silently fixing it in this packet.

## 4. Explicitly deferred to `UX-R03e`

`/timetable/runs` and `/timetable/setup`. **Reason:** there is no composable run-list
surface today — `GeneratedRunRailPanels.tsx` exports `GeneratedViolationsPanel` and
`GeneratedUnassignedPanel`, not a run list — so those pages are a design decision about
what a Runs/Setup page shows, not a routing exercise. Inventing them inside an executor
run would produce a page nobody asked for.

## 5. Part B — deployment

Rows 1-8 of `CURRENT-SOURCE-LIVE-DEPLOY-C02` apply **verbatim**, with: the incumbent and
rollback basis bound to the release live at execution start (expected `c93dd2ee…`); and
the artifact marker being the **new** entry chunk, which must differ from the incumbent's
recorded chunk. Reuse that packet's frozen boundary, preconditions, authorized mutations
and rollback section unchanged: isolated release with its own dependency trees, no
environment byte changed, SMART/AIMS inactive, no migration or database write, ports
5001/5174 only, elevated executor, single start via the registered task, signature map
byte-identical using the C01 addendum's SQL verbatim.

## 6. Part C — browser acceptance (custody with QA)

**Custody goes to the independent QA task**, not the planner. The planner has released the
profile; the QA session is the single controller for the pass and closes it. One
authorized login expected; disclose its audit row. **Read-only:** no Save, Apply,
Generate, Publish or Delete, and no timetable cell click (a click places a session). The
export settings dialog exposes a PUT — inspect, persist nothing.

1. **The headline row: no remount.** For each of the seven `/timetable*` routes, perform a
   **real in-app** round trip (a sidebar/link navigation out and back, not a synthetic
   `pushState`) and assert the **same element instance** for the workspace root and for
   `timetable-left-panel` — the check that failed before this change — plus **zero** new
   `/api/v1/` requests. Report the observed values both ways so the before/after is
   unambiguous.
2. **No regression outside the subtree.** Navigating between two non-timetable pages that
   share a parent path still behaves as it does today (spot-check one such pair and say
   which you chose).
3. **Viewport.** No global horizontal or vertical window scrollbar at `1366x768` on all
   seven routes.
4. **The header export control** (Part 3 above) — open it, persist nothing.
5. **Report-only diagnosis, no fix required.** Attempt to reproduce the intermittent
   `/api/v1` 502s and the intermittent workspace non-mount under rapid sequential
   child-route loads. Report how many loads you performed, how many 502s and which routes,
   whether any duplicate concurrent identical requests occur, and whether the non-mount
   correlates with a 502. If it does not reproduce, say so plainly — a clean negative is
   a valid result.

## 7. Acceptance — 10 mandatory rows

1: key helper collapses the seven timetable paths and leaves non-timetable paths
byte-identical — source-proven.
2: `routeEpoch` still forces a remount, with its callers listed — source-proven.
3: the new focused test exists and passes — source-proven.
4: no functional regression; the full client suite passes unchanged, and this packet
authorizes **no** existing-test modification — source-proven.
5-9: Part B deployment rows 1-8 — reproduced by post-action QA.
10: Part C browser rows 1-5 — reproduced by the QA browser pass, with row 1 as the
headline and row 5 report-only.

`ACCEPT_READY` requires 10/10 passed, 0 blocked, 0 unperformed. A row that cannot be
performed is reported `BLOCKED`/`UNPERFORMED` with its reason. The deployment must not be
called accepted on rows the QA did not reproduce.

## 8. Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the key
function's before/after behaviour with the test output, the decisive commands, the 10 rows
with their own results, the browser element-identity values, the login disclosure, the
502 diagnosis result, rollback status, and risks marked `BLOCKING`/`NON_BLOCKING`. No
transcripts, secrets or database rows.
