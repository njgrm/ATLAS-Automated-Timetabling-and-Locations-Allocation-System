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

- `useScheduleReviewWorkspaceState.ts:532-556` — the **authority**. It gates behaviour
  (teacher moves, start/end windows, recess/lunch) and must hold the value **even when
  the policy pane is unmounted**, i.e. on the schedule grid. It also carries the A-16
  invariant: clear the previous scope's policy *before* refetching, so a failed read can
  never leave stale or permissive policy across a school/year change.
- `SchedulingPolicyPane.tsx:280-310` — the **editor**. It hydrates its editable local
  state from the full record and also reads grade windows, section summary and special
  events.

**Required change:** the workspace keeps ownership; the pane stops issuing its own
policy GET.

1. Widen the workspace's stored policy to the full `SchedulingPolicy` record (it
   currently keeps a narrow projection) so the pane can hydrate from it, and expose that
   value plus a refetch trigger through the existing workspace context.
2. Remove the pane's `GET /policies/scheduling/...` call. The pane hydrates from the
   workspace value and keeps its own grade-windows / section-summary / special-events
   reads.
3. After a successful policy save, the pane must trigger the workspace refetch so both
   consumers converge on the saved value — one refresh path, not two.
4. **Preserve the A-16 scope-clearing behaviour exactly**: the policy is still cleared
   before a scope-driven refetch, and a failed read still cannot leave a stale or
   permissive policy in place.

**Acceptance:** with the policy pane mounted, exactly **one** GET to that endpoint per
scope per load — and **zero 502s** on a clean load of `/timetable/policies`. If a 502
still occurs after de-duplication, capture the host and server log evidence and report
it; do not paper over it, and do not weaken the fail-closed `setPolicy(null)` path.

### A2. Chrome overrides for the routes added in R03a/R03b

`navigation.ts` carries chrome overrides keyed by route. Add entries for
`/timetable/pre-generation`, `/timetable/map`, `/timetable/manual-edit` and
`/timetable/building` so they stop falling back to generic `ATLAS` chrome, matching the
existing `/timetable/policies` entry's shape. Cosmetic only; no routing or behaviour
change.

### A3. `/timetable/exports` as the third operator sub-page

Add an element-less `exports` child under the existing mounted `/timetable` parent and
compose it from the export controls that already exist on the Simple surface — **reuse
the existing components and handlers; do not rebuild the export feature, do not change
what it emits, and do not move it off the header** (the header control keeps working).
The route is additive: it gives the operator a place to land, it does not become the
only path.

**Explicitly deferred to `UX-R03d`:** `/timetable/runs` and `/timetable/setup`. They are
composition tasks over larger surfaces (`GeneratedRunRailPanels`, the setup/drift
controls) and are deliberately kept out of this diff so the behavioural change above is
reviewable in isolation.

## Part B — deployment

Rows 1-8 of `CURRENT-SOURCE-LIVE-DEPLOY-C02` apply **verbatim**: release identity (read
`releaseSha`, never `productPin`), ownership, health, public term truth, warning
protection, served-artifact identity (the new entry chunk must differ from the incumbent
`index-BZ9J8198.js` and the served bundle must carry `/timetable/exports`), configuration
(env bytes unchanged, SMART/AIMS inactive), and the schema-wide signature map
byte-identical using the C01 addendum's SQL **verbatim**. Reuse that packet's frozen
boundary, preconditions, authorized mutations and rollback section unchanged: isolated
release with its own dependency trees, no environment byte changed, no migration or
database write, ports 5001/5174 only, elevated executor, single start via the registered
task, and the incumbent as the startable rollback basis.

## Part C — browser acceptance (custody handed to QA)

**Browser custody for this cycle goes to the independent QA task**, not the planner, so
these rows are reproduced by someone other than the author of the code and the packet.
The planner releases the profile; the QA session is the single controller for the pass
and closes it when done. One authorized login is expected; disclose its audit row.

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

## Acceptance — 14 mandatory rows

1-3: A1 (single GET; pane hydrates and saves; A-16 preserved) — source-proven.
4: A2 chrome overrides — source-proven.
5: A3 exports pane composed without rebuilding or moving the feature — source-proven.
6: no functional regression; the existing client suites pass unchanged — source-proven.
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
