# UX-R03c — one-shot: policy read ownership + exports sub-page + chrome, deployed and browser-accepted

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization
(`AGENTS.md` §13). One cycle: source change, deployment, and browser acceptance, with
every gate retained.

Risk: **MEDIUM** source (one behavioural change) with **HIGH** deployment.

Base: the `origin/main` tip in the dispatch prompt. Target release:
`D:\ATLAS-runtime-supervised-<pin>-20260920`.

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## Part A — source change (the only behavioural work in this cycle)

### A1. The policy read gets one owner (the operator's decision, implemented)

Two consumers currently GET `/policies/scheduling/{schoolId}/{schoolYearId}`:

- `useScheduleReviewWorkspaceState.ts:532-556` — the **authority**. It must hold the value
  **even when the policy pane is unmounted**: its real consumer is `policyAlignmentWarning`
  (`useScheduleReviewWorkspaceState.ts:1581-1612`), computed on the grid/simple surface and
  rendered at `TimetableSimpleHeader.tsx:575`. It also carries the A-16 invariant: clear
  the previous scope's policy *before* refetching, so a failed read can never leave stale
  or permissive policy across a school/year change.
- `SchedulingPolicyPane.tsx:280-310` — the **editor**. It hydrates its editable local
  state from the full record and also reads grade windows, section summary and special
  events.

**Required change:** the workspace keeps ownership; the pane stops issuing its own
policy GET.

1. Add a **separate** full-record field for the pane (for example `policyRecord`) beside
   the existing narrow projection, and expose it plus a **new** refetch trigger through
   the workspace context. Do **not** widen the existing narrow `policy` type: typed
   fixtures (`timetable-dynamic-workspace-rendered.test.ts:211`,
   `ux-quickfix-c01-header-actions.test.ts:128`) build partial policy objects and would
   break for no benefit.
2. Remove the pane's `GET /policies/scheduling/...` call. The pane hydrates from the
   workspace record and keeps its own grade-windows / section-summary / special-events
   reads.
3. **The refetch trigger must be added, not reused.** `onPolicySaved={handleRefresh}`
   (`CenterWorkspace.tsx:392`) routes to `loadAll` (`useTimetableData.ts:1580`), which
   does **not** re-run the policy effect (its deps are `[schoolId, schoolYearId]`,
   `:556`). Add a dedicated refresh in the hook and thread it to the pane so a save
   converges both consumers on the saved value through one path.
4. **Preserve the A-16 scope-clearing behaviour exactly**, and mirror it in the pane's
   hydration: a null or failed read must leave the pane's `policyStatus` fail-closed
   (`unavailable`), and hydration must **not** clobber dirty `local` state or
   `editIntent`.

**Acceptance:** with the policy pane mounted, exactly **one** GET to that endpoint per
scope per load — and **zero 502s** on a clean load of `/timetable/policies`. If a 502
still occurs after de-duplication, capture the host and server log evidence and report
it; do not paper over it, and do not weaken the fail-closed `setPolicy(null)` path.

### A2. Chrome overrides for the routes added in R03a/R03b

`navigation.ts` carries chrome overrides keyed by route (`navigation.ts:64-79`). Add
entries for `/timetable/pre-generation`, `/timetable/map`, `/timetable/manual-edit`,
`/timetable/building` **and `/timetable/exports`** so none falls back to generic `ATLAS`
chrome, matching the existing `/timetable/policies` entry's shape. Cosmetic only; no
routing or behaviour change.

### A3. `/timetable/exports` as the third operator sub-page

Add an `exports` child under the existing mounted `/timetable` parent and compose it from
the export controls that already exist on the Simple surface: reuse `SimpleExportMenu` and
`ExportPresentationSettingsDialog` (`TimetableSimpleHeader.tsx:66-70`) with their existing
orchestration (`TimetableSimpleHeader.tsx:106,306-350`) and the request helpers in
`simpleExportRequests.ts` (`resolveSimpleExportRequest` / `dispatchSimpleExport`). Extract
that orchestration into a shared unit rather than duplicating it; **do not rebuild the
export feature, do not change what it emits, and do not remove it from the header** — the
header control keeps working and the route is an additional place to land.

This is a real routing change, not an element-less child: it must add the
`TimetableRoutedView` / `TimetableCenterRoute` mapping (`TimetableRouteViewSync.tsx:10-34`),
the `App.tsx` child (`:176-177`) and the `CenterWorkspace` `exports` view, and it
**authorizes updating the two assertions that currently pin exports as deferred** —
`ux-r03a-nested-timetable-route.test.ts:67` and `ux-r03b-center-view-routes.test.ts:61`
both assert `resolveTimetableRouteView('/timetable/exports') === 'schedule'`. Those two
assertion updates are the only test changes this packet permits, and acceptance row 6
excludes them.

**Explicitly deferred to `UX-R03d`:** `/timetable/runs` and `/timetable/setup`. They are
composition tasks over larger surfaces (`GeneratedRunRailPanels`, the setup/drift
controls) and are deliberately kept out of this diff so the behavioural change above is
reviewable in isolation.

## Part B — deployment

**Incumbent and rollback basis: `d50dde642c10b1ea6fdc9097266ace53cdba2063`** at
`D:\ATLAS-runtime-supervised-d50dde64-20260920` — the currently live release, startable
and junction-free. Do not reuse C02's `74999168` rollback binding: that release is now the
older generation.

Rows 1-8 of `CURRENT-SOURCE-LIVE-DEPLOY-C02` otherwise apply **verbatim**: release
identity (read `releaseSha`, never `productPin`), ownership, health, public term truth,
warning protection, served-artifact identity — the new entry chunk must differ from the
incumbent `index-BZ9J8198.js` and the served bundle must carry the **new** marker
`/timetable/exports` (C02's `/timetable/policies` marker is already in the live bundle and
no longer proves anything) — configuration (env bytes unchanged, SMART/AIMS inactive), and
the schema-wide signature map byte-identical using the C01 addendum's SQL **verbatim**.
Reuse that packet's frozen
boundary, preconditions, authorized mutations and rollback section unchanged: isolated
release with its own dependency trees, no environment byte changed, no migration or
database write, ports 5001/5174 only, elevated executor, single start via the registered
task, and the incumbent as the startable rollback basis.

## Part C — browser acceptance (custody handed to QA)

**Browser custody for this cycle goes to the independent QA task**, not the planner, so
these rows are reproduced by someone other than the author of the code and the packet.
The planner releases the profile; the QA session is the single controller for the pass
and closes it when done. One authorized login is expected; disclose its audit row.

**Read-only.** No Save, Apply, Generate, Publish or Delete, and no timetable cell click (a
cell click places a session). This matters for row 4:
`ExportPresentationSettingsDialog` exposes `saveExportPresentationSettings` (a PUT) at
`ExportPresentationSettingsDialog.tsx:42,85` — open and inspect the export surface, persist
nothing from it.

Rows:

1. **Route round trip, all seven routes.** For `/timetable`, `/timetable/policies`,
   `/timetable/pre-generation`, `/timetable/map`, `/timetable/manual-edit`,
   `/timetable/building` and the new `/timetable/exports`: a round trip away and back
   keeps the review workspace mounted (same element instance) and issues **zero** new
   data requests.
2. **Viewport.** No global horizontal or vertical window scrollbar at `1366x768` on all
   seven routes.
3. **Policy read, single request.** A clean load of `/timetable/policies` issues exactly
   one request to `/api/v1/policies/scheduling/{schoolId}/{schoolYearId}` and produces no
   502. Report the observed request count and statuses.
4. **Exports route.** `/timetable/exports` renders the composed export surface and the
   header's own export control still works.

## Acceptance — 18 mandatory rows

1-3: A1 (single GET; pane hydrates and saves; A-16 preserved) — source-proven.
4: A2 chrome overrides — source-proven.
5: A3 exports pane composed without rebuilding or moving the feature — source-proven.
6: no functional regression; the existing client suites pass, excluding only the two
A3-authorized assertion updates — source-proven.
7-14: Part B deployment rows 1-8 — reproduced by post-action QA.
15-18: Part C browser rows 1-4 — reproduced by the QA browser pass and labelled browser
rows.

`ACCEPT_READY` requires 18/18 passed, 0 blocked, 0 unperformed. A row that cannot be
performed is reported `BLOCKED`/`UNPERFORMED` with its reason; a browser row that cannot
be decided is reported as such rather than marked performed.

## Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the
decisive commands with results, the 18 rows with their own results and labels, the
observed policy request count and statuses, the login disclosure, rollback status, and
known risks marked `BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database rows.
