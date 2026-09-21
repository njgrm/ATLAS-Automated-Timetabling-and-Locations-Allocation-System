# UX-R03e — one-shot: the Runs and Setup sub-pages, deployed and browser-accepted

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization
(`AGENTS.md` §13). One cycle: one composed pane, deployment, browser acceptance with QA
custody.

Risk: **MEDIUM** source (a composed pane, no behaviour change to existing controls) with
**HIGH** deployment.

Base: the `origin/main` tip in the dispatch prompt. Incumbent and rollback basis: the
release live when the executor starts (expected `5f5c6c4f…`).

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Why this packet, and why not the Runs page

The remaining timetable sub-pages were `/timetable/runs` and `/timetable/setup`.

**Correction to the r1 premise — I was wrong and the reviewer was right.** A run-list
endpoint **does exist**: `GET /api/v1/generation/:schoolId/:schoolYearId/runs` ("run
history") at `atlas-server/src/routes/generation.router.ts:528-559`, backed by
`genService.listRuns(...)` (`generation.service.ts:1173`) and mounted at `app.ts:113`. The
r1 text claimed no such endpoint existed; that was a bad search, not a fact. The Runs page
is therefore **composable**, and this cycle builds it (§2 A1) alongside Setup (§2 A2).

## 2. The source change

### A1. `/timetable/runs` — the Runs sub-page

Add a `runs` child under the mounted `/timetable` parent and render a **read-only** run
history from the existing endpoint `GET /api/v1/generation/:schoolId/:schoolYearId/runs`
(`generation.router.ts:528`, `listRuns`). Show the school year's runs using the fields the
endpoint actually returns, and let the operator **select** a run through the run-selection
mechanism the workspace already uses — do not invent a second selection path. Add **no**
generation, publication or delete action to this page.

If `listRuns` does not return enough to render an honest list, report the pane `BLOCKED`
with the observed response shape rather than padding it with invented fields.

### A2. `/timetable/setup` — the Setup sub-page

Add an `setup` child under the existing mounted `/timetable` parent, exactly as
`UX-R03c` added `exports`, and compose it from the setup-truth surfaces that already exist
on the Simple timetable:

- the sync-with-setup control (`timetable-simple-sync-setup`),
- the input-drift banner (`timetable-simple-input-drift`) and the room-repair affordance
  (`timetable-simple-repair-rooms`),
- the setup-name refresh item currently buried in the More menu
  (`timetable-refresh-setup-names`),
- the readiness chip and publish-readiness sheet (`timetable-simple-readiness-chip`,
  `SimplePublishReadinessSheet`).

**Reuse the existing components and units, and do not fork a third handler.** Render
`SimpleDriftBanner` directly — it owns `timetable-simple-sync-setup` (`:191`),
`timetable-simple-input-drift` (`:110`) and the room-repair affordance (`:146`) — and reuse
the existing shared unit `runSyncSetup` / `createSyncSetupInFlightGuard`
(`atlas-client/src/lib/timetable-sync-setup.ts`, already consumed by `SimpleDriftBanner.tsx:10,76`
and duplicated in `ScheduleReviewWorkspaceHeader.tsx:152-162`). **Do not add a second
`handleSyncSetup`.** The readiness chip is inline JSX (`TimetableSimpleHeader.tsx:444-465`,
deriving `readinessLabel(context)` and `publishBlocked`) and the setup-name refresh is a
More-menu item (`SimpleMoreMenuContent.tsx:160`, bound to the header context plus
`onClose`); extract both so the header and the pane share one implementation. **Every
existing control keeps working where it is** — the header and More-menu entry points must
remain, and this route is an additional place to land. **No behaviour change**: do not alter
what sync, repair, refresh or the readiness sheet do, and do not change what any of them
emit or persist.

### A3. Wiring for both panes

For each of `runs` and `setup`: the `TimetableRoutedView` / `TimetableCenterRoute` mapping
in both directions, the `App.tsx` child, the `CenterWorkspace` view, and a `navigation.ts`
chrome override alongside the ones added in `UX-R03c`/`R03d`. This also **authorizes
updating the two assertions that pin setup as unrouted** —
`ux-r03a-nested-timetable-route.test.ts:66` and `ux-r03b-center-view-routes.test.ts:60`
both assert `resolveTimetableRouteView('/timetable/setup') === 'schedule'` — mirroring the
exports precedent the `R03c` packet set. Those updates plus the new test file are the only
test changes this packet permits.

### A4. Checkpoint each pane

Commit `runs` as its own commit before starting `setup`, so a step limit leaves a usable
checkpoint instead of a half-built tree. Do not amend a commit that has been reported.

### A5. Do not fix the duplicate-GET lead in this packet

QA observed **eight endpoints issuing concurrent duplicate identical GETs**. That is a
plausible cause of the intermittent host-proxy 502s, but coalescing duplicate requests in
`atlasApi` would touch **every** API call in the client — a broad behavioural change that
does not belong in a pane cycle. It is a **report-only** browser row here (§4) and a
candidate for its own reviewed stream.

## 3. Part B — deployment

**Target pin: the accepted candidate commit of this cycle**, built into
`D:\ATLAS-runtime-supervised-<candidate-sha>-20260921`. Every literal is re-captured at
execution and never copied from an earlier packet: the incumbent is the release live at
start (expected `5f5c6c4f…`), and the artifact marker is the **new** entry chunk, which
must differ from that incumbent's recorded chunk. Otherwise reuse
`CURRENT-SOURCE-LIVE-DEPLOY-C02`'s frozen boundary, preconditions, authorized mutations and
rollback section unchanged in structure: isolated release with its own dependency trees, no
environment byte changed, SMART/AIMS inactive, no migration or database write, ports
5001/5174 only, elevated executor, single start via the registered task, and the
schema-wide signature map byte-identical using the C01 addendum's SQL **verbatim**.

## 4. Part C — browser acceptance (custody with QA)

**This section is the narrative; the itemized tallies for it are rows 9a-9e in §5.**

**Custody goes to the independent QA task.** The planner releases the profile; the QA
session is the single controller and closes it. One authorized login expected; disclose its
audit row. **Read-only: no Save, Apply, Generate, Publish or Delete, and no timetable cell
click** (a click places a session). The export settings dialog and the publish-readiness
sheet both expose actions — open and inspect, persist nothing.

1. **`/timetable/setup` renders** the composed setup surface, and each reused control still
   works from its **original** home (header and More menu) as well.
2. **No remount inside the subtree** still holds after this change: moving between
   `/timetable*` routes via the app's own controls keeps the same workspace element
   instances with zero new `/api/v1/` requests. `history.pushState` is forbidden.
3. **Viewport:** no global horizontal or vertical window scrollbar at `1366x768` on all
   eight `/timetable*` routes.
4. **Report-only diagnosis of the duplicate-GET lead.** Instrument nothing and fix nothing:
   on a clean load of `/timetable` and of `/timetable/setup`, record how many
   concurrent duplicate identical `/api/v1/` GETs occur, on which endpoints, and whether
   any 502 follows. State plainly whether the duplicates reproduce and whether they
   correlate with a 502 — a clean negative is a valid result.
5. **No regression outside the subtree:** one non-timetable nested pair still remounts as
   before.

## 5. Acceptance — 13 mandatory rows

**Source (4)**
1: the `runs` route is wired in both mapping directions with its `App.tsx` child, its
`CenterWorkspace` view and its chrome override, and the list renders from the existing
endpoint with no generation/publication/delete action — source-proven.
2: the `setup` route is wired the same way and composes the named existing controls, with
`runSyncSetup`/`createSyncSetupInFlightGuard` reused and the readiness chip and refresh item
extracted so header and pane share one implementation — source-proven.
3: every existing entry point for those controls still works from its original home —
source-proven.
4: the new test file is reachable from a committed `package.json` script in the same commit
(`AGENTS.md` §11); the client type-check and the full client suite pass, including the two
authorized assertion updates — source-proven.

**Deployment (4)**
5: release identity — installed HEAD and clean status, both machine-scope values, task
action/arguments/working directory, and supervisor-state `releaseSha` (never `productPin`).
6: ownership — one listener per port, both descending from the task-launched supervisor,
task properties intact.
7: health, public term truth and warning protection — local/host/Tailnet health and a
DB-backed read; valid `termIndex` non-5xx and term-scoped with typed `400` on malformed
input; unauthenticated violation routes 401.
8: served-artifact identity, configuration and zero write — served HTML and every
referenced asset matching the built manifest with the new entry chunk differing from the
incumbent's; env bytes and key set unchanged; SMART/AIMS inactive with typed 503s; and the
schema-wide signature map byte-identical.
Rows 5-8 are reproduced by post-action QA.

**Browser (5)**
9a: `/timetable/runs` renders the run history and selecting a run works.
9b: `/timetable/setup` renders the composed surface and each reused control still works from
its original home.
9c: no remount inside the subtree — moving between `/timetable*` routes via the app's own
controls keeps the same workspace element instances with zero new `/api/v1/` requests
(`history.pushState` forbidden).
9d: viewport — no global horizontal or vertical window scrollbar at `1366x768` on all eight
`/timetable*` routes.
9e: **report-only** duplicate-GET diagnosis — how many concurrent duplicate identical
`/api/v1/` GETs occur on clean loads of `/timetable` and `/timetable/setup`, on which
endpoints, and whether any 502 follows. No fix, no instrumentation; a clean negative is a
valid result.
Rows 9a-9e are reproduced by the QA browser pass.

`ACCEPT_READY` requires 13/13 passed, 0 blocked, 0 unperformed. A row that cannot be
performed is reported `BLOCKED`/`UNPERFORMED` with its reason. The deployment must not be
called accepted on rows QA did not reproduce.

## 6. Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the decisive
commands, the 13 rows with their own results, the browser element-identity and
request-count values, the duplicate-GET diagnosis, the login disclosure, rollback status,
and risks marked `BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database rows.
