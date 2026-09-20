# UX-R03a — nested timetable layout route (grid stays mounted) + first sub-page

Status: **PREPARED — NOT APPROVED; awaiting cycle dispatch.**

Risk: **MEDIUM** client source with **HIGH interaction guardrails** (unsaved-change
guard, grid-mount persistence, publication/ordered-term invariants).

Base: `origin/main` at the tip recorded in the dispatch prompt. Client source only:
this packet authorizes **no** server, route-authority, runtime, deployment,
generation, publication, database, or companion change.

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Objective

Give the operator real sub-pages under `/timetable` so policy/setup/export surfaces
stop competing with the schedule grid on one screen, **without** paying a remount or
refetch each time they navigate. This is the first increment of `UX-R03` from the
audit's stream order (`docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md`),
and it is unblocked because `UX-P01` (data layer), `UX-R01/R01a`, `UX-R02` and
`UX-R06` are all integrated and deployed.

## 2. Design constraint that defines this packet

`CenterWorkspace.tsx` already models the center surface as one state field:

```
centerView: 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building'
```

switched through `switchCenterViewWithGuard` / `enterPolicyView` (`SimpleMoreMenuContent.tsx`
currently reaches policy with a `requestAnimationFrame(() => switchCenterViewWithGuard(enterPolicyView))`
hack).

**Make the URL the source of truth for that existing state for the two routes in
scope, rather than introducing parallel page components.** Reusing the existing
state means the grid, the query cache and the scope machinery are untouched, which is
what keeps navigation fast and behaviour identical.

## 3. Scope of this increment

Deliver exactly:

1. A persistent nested route under `/timetable`:
   - `/timetable` (index) → `centerView = 'schedule'` (today's default).
   - `/timetable/policies` → `centerView = 'policy'` (renders the existing
     `SchedulingPolicyPane` through the existing context, unchanged props).
2. The workspace shell renders **once** for both routes; navigating between them must
   not unmount the review workspace, the grid, or the query cache.
3. The route → `centerView` transition must pass through the **existing guarded**
   setter, so the unsaved-change guard is never bypassed by navigation or by direct
   URL entry. The guard's current behaviour is the contract; do not weaken it.
4. `SimpleMoreMenuContent.tsx`: the "Scheduling policy (Advanced)" item becomes a real
   navigation link to `/timetable/policies` (no `requestAnimationFrame` state hack).
   The Advanced header's own policy entry keeps working.
5. Unknown or unsupported child routes under `/timetable` fall back to the index
   behaviour (never a blank center surface).

Explicitly **out of scope** (deferred to `UX-R03b`): `/timetable/runs`,
`/timetable/setup`, `/timetable/exports`, the `/map` dedupe, and routing the
`pre-generation`, `manual-edit`, `map` and `building` center views. The remaining four
center views stay reachable exactly as they are today, so no operator capability is
lost by this increment.

## 4. Boundaries — do not break these

- `ScheduleReviewWorkspace.tsx` `buildScopeKey` / `clearScopeState`: scope-change
  hygiene must survive routing. Do not move, rename or re-implement them.
- **No-scroll architecture:** the root `flex flex-col h-[calc(100svh-3.5rem)]` with
  `flex-1 min-h-0 overflow-auto` for scrolling regions. Never introduce a global
  window scrollbar on either route.
- **Publication and ordered-term invariants:** one selected ordered term preserves
  subject/teacher/room and full weekly demand; publication gates are unchanged.
- **shadcn/Radix primitives only** — no native `<select>`, no raw unstyled buttons,
  no `<details>`/`title` attributes. Route everything through `@/ui/*`.
- **1000-line component cap.** `CenterWorkspace.tsx` (736), `ScheduleReviewWorkspace.tsx`
  (683), `TimetableSimpleHeader.tsx` (888), `SimpleMoreMenuContent.tsx` (162) are under
  it today; if your change would push any of them over, extract first, in the same
  commit.
- Desktop-first. Mobile is explicitly de-prioritized; do not spend effort there.
- **No behaviour change** to Generate, Publish, Preview impact, Sync with setup,
  exports, filters, the tutorial, or the status key. This packet changes navigation,
  not functionality.

## 5. Authorized paths

`atlas-client/src/App.tsx` (or wherever the client route table lives),
`atlas-client/src/components/timetable/**`,
`atlas-client/src/components/app-shell/navigation.ts`,
`atlas-client/src/pages/ScheduleReview.tsx` (only if the route host lives there), and
focused client tests under `atlas-client/src/**/__tests__/**`. Nothing else.

## 6. Acceptance — 8 mandatory rows

1. **Routes exist and render.** `/timetable` shows the Simple header and the schedule
   grid; `/timetable/policies` shows the same shell with the policy pane. Cite the
   route, the accessibility snapshot and the origin `https://njgrm.buru-degree.ts.net`
   for live rows, or a rendered-test row for source-only rows.
2. **No workspace remount and no refetch (amended 2026-09-20 after QA).** Navigating
   `/timetable` → `/timetable/policies` → `/timetable` must keep the **review
   workspace** — shell, query cache, scope state — mounted, and must issue **no new
   data request** on the round trip. The center *pane* switching (grid ⇄ policy) is
   expected and pre-existing: `CenterWorkspace` renders one center view at a time, so
   keeping a heavy grid element mounted behind a panel is explicitly **not** required.
   The literal "same grid element instance" wording in the r1 packet was unachievable
   by construction and is withdrawn. In-source proof is the structural argument
   (element-less children, one parent element, zero new request sites) plus tests; the
   empirical DOM-identity and request-count proof belongs to the next deployment's
   acceptance and must be listed as an open deployment-acceptance item.
3. **Guard preserved, and its cancel path is consistent.** A route-driven center-view
   change runs the guarded setter. Prove it by test (the route→view effect calls the
   guarded path) and, if a guarded state can be produced without a mutation, by
   rendered behaviour. Direct URL entry while guarded must surface the guard, not
   silently discard. **New in this revision (QA finding F2):** when the operator
   cancels the guard ("stay here"), the URL must return to the route the operator is
   actually on — a cancelled navigation must never leave the address bar describing a
   center view the pane is not showing.
4. **More menu.** The policy item navigates to `/timetable/policies` as a link; no
   `requestAnimationFrame` state workaround remains for it; the Advanced header's
   policy entry still opens policy.
5. **Unknown child route** falls back to the index surface (no blank center, no crash).
6. **Layout invariants.** Neither route produces a global scrollbar at `1366x768`;
   no native `<select>`; no new raw button; the 12px chrome floor holds. The viewport
   measurement is a browser clause and is deferred to the deployment acceptance.
7. **No functional regression.** Generate / Publish / Preview impact / Sync with setup
   behaviour is unchanged, and the ordered-term + actor-school invariants are intact.
   Existing client suites that cover them must pass unchanged.
8. **File-size cap** holds for every file this change touches, with any extraction
   done in the same commit.

## 7. Verification the executor must run and report

`npm run build` (or the client type-check + build entry point) for `atlas-client`, the
focused client test suites for the touched components, plus any new tests added, with
exact commands and observed results. Report the live-vs-source distinction explicitly:
source-only rows are proven by rendered tests or snapshots, never by the deployed page.

## 8. Rollback

Revert the commit. This packet changes no persisted state, no schema, no environment
and no runtime artifact, so rollback is a source revert with no data consequence.

## 9. Return

One short handoff: base SHA · candidate SHA · exact changed paths · the decisive
commands and results · rows 1–8 with `pass`/`blocked`/`unperformed` · known risks each
marked `BLOCKING` or `NON_BLOCKING` · verdict. One page; no transcripts.
