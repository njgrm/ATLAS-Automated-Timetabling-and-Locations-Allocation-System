# ATLAS × SMART UX Convergence — Implementation Handoff

- **Stream:** `SMART-UX-AUDIT-C01`
- **Handoff date:** 2026-09-12 (Asia/Manila)
- **Source evidence:** `docs/reports/smart-registrar-teacher-ux-identity-audit-2026-09-12.md`
- **Design contract:** `docs/design/atlas-smart-ux-convergence-contract.md`
- **ATLAS base:** `origin/main` `904818d4`
- **SMART reference:** `c3806e12` (READ_ONLY) — must remain READ_ONLY for every stream below.

> **This handoff authorizes no implementation.** It ranks and scopes candidate streams for the
> primary planner. No stream may start until the planner issues a bounded executor packet with an
> accepted base SHA, owned/forbidden paths, and acceptance criteria. Nothing here authorizes
> deployment, migration, generation, publication, or any live data write.

---

## 1. Ranking rationale

Ranking is by (a) user-visible calm/consistency gain, (b) file-ownership clarity, (c) dependency
safety given the current living register (W1 runtime already deployed, RR-TERM-CACHE-C01 ready, live
generation/publication locked). Documentation-only and presentation-only streams are ranked above
behavioral ones because they are independently reviewable and do not touch scheduling authority.

Priority order:

1. **UX-CONV-01 — Token & primitive convergence** (foundation; everything depends on it)
2. **UX-CONV-02 — Canonical page header adoption**
3. **UX-CONV-03 — Canonical list/table unification**
4. **UX-CONV-04 — Lifecycle/blocker presentation unification**
5. **UX-CONV-05 — Teaching Load calm hierarchy**
6. **UX-CONV-06 — Simple Timetable calm hierarchy**
7. **UX-CONV-07 — Faculty portal header/state unification**
8. **UX-CONV-08 — Login/accessibility correction** (SMART-informed ATLAS fixes only)

---

## 2. Streams

### UX-CONV-01 — Token & primitive convergence

- **Objective:** Eliminate raw gray/palette drift in shared primitives and establish one token
  contract so every later stream inherits consistency.
- **Owned paths (proposed):**
  - `atlas-client/src/index.css` (tokens only; no layout behavior)
  - `atlas-client/src/ui/card.tsx`, `atlas-client/src/ui/button.tsx`,
    `atlas-client/src/ui/badge.tsx`, `atlas-client/src/ui/table.tsx`,
    `atlas-client/src/ui/tabs.tsx`, `atlas-client/src/ui/skeleton.tsx`
  - one focused token/primitive test file
- **Objective change:** replace `zinc-*/slate-*/gray-*` with semantic tokens in the primitives;
  ensure `font-black` is disallowed outside login.
- **Dependencies:** none.
- **Collision boundaries:** must not change page layouts, routing, or any `pages/**` behavior; must
  not touch Timetable or Teaching Load component trees.
- **Largest coherent one-shot scope:** primitives + token tests only. Do **not** sweep 55 pages in
  the same commit.
- **Acceptance evidence:**
  - a grep census proving zero raw gray tokens inside `atlas-client/src/ui/**`
  - existing client type-check + build
  - focused primitive render test
- **Live browser gate:** visual spot-check of one page per portal at `1366x768` and `390x844` after
  a later runtime deploy (not in the source stream).
- **Planner decisions needed:** none.

### UX-CONV-02 — Canonical page header adoption

- **Objective:** One header contract for all primary pages; remove hand-rolled `<h1>` chrome.
- **Owned paths (proposed):**
  - a promoted header primitive in `atlas-client/src/components/smart/` (extend `SmartCommandBar`;
    do not fork a second component)
  - `atlas-client/src/pages/Dashboard.tsx` (header region only)
  - `atlas-client/src/pages/Subjects.tsx`, `Sections.tsx`, `Faculty.tsx`, `AdminYearSetup.tsx`,
    `Audit.tsx` (header region only)
  - focused tests
- **Dependencies:** UX-CONV-01.
- **Collision boundaries:** must not change data hooks, mutation handlers, or navigation. Header-only
  edits keep the diff reviewable and avoid conflicts with scheduling streams.
- **Largest coherent one-shot scope:** the shell/route-level pages listed above. Timetable/Teaching
  Load headers move in their own streams (05/06).
- **Acceptance evidence:** route-level render/accessibility tests asserting exactly one `h1` and the
  expected eyebrow/title/subtitle/actions; existing suites green.
- **Live browser gate:** desktop + mobile header snapshot for each migrated route.
- **Planner decisions needed:** confirm whether the header primitive name is `SmartCommandBar` or a
  new `PageHeader` (naming only).

### UX-CONV-03 — Canonical list/table unification

- **Objective:** One list system (toolbar + states + 1-based pagination) across ordinary lists.
- **Owned paths (proposed):**
  - `atlas-client/src/components/admin-workspace/AdminDataTable.tsx` (extend as the canonical table)
  - `atlas-client/src/pages/Subjects.tsx` list region, `TeachingLoadHistoryView.tsx`,
    `RoomSchedules.tsx` list regions
  - focused tests
- **Dependencies:** UX-CONV-01, UX-CONV-02.
- **Collision boundaries:** must not touch the class-record ledger, SF grids, or print matrices
  (sanctioned exceptions); must not change list endpoints.
- **Largest coherent one-shot scope:** the three list surfaces above; iterate on the shared component
  in the same stream.
- **Acceptance evidence:** loading/empty/error/pagination state tests; grep proving the page uses the
  canonical footer.
- **Live browser gate:** list interaction at both viewports (filter, paginate, empty search).
- **Planner decisions needed:** which pages are in the first wave if the planner wants a smaller
  first slice.

### UX-CONV-04 — Lifecycle/blocker presentation unification

- **Objective:** One blocker/next-step presentation reused by Dashboard, Teaching Load, and Timetable.
- **Owned paths (proposed):**
  - `atlas-client/src/components/smart/SmartPageShell.tsx` (`SmartNextStepCard`, state components)
  - a shared blocker card component extracted from `pages/Dashboard.tsx` `pickNextStep` rendering
  - `atlas-client/src/pages/Dashboard.tsx` (blocker region only)
  - focused tests
- **Dependencies:** UX-CONV-01, UX-CONV-02.
- **Collision boundaries:** must not alter the derived-demand authority logic; presentation only.
  `pickNextStep`/`deriveDerivedDemandRepair` remain the single decision source.
- **Largest coherent one-shot scope:** extract + adopt on Dashboard; Teaching Load/Timetable adoption
  happens in 05/06.
- **Acceptance evidence:** tests proving a blocker still renders with its repair link and that no
  blocker is suppressed; existing authority tests green.
- **Live browser gate:** blocked-state rendering at both viewports.
- **Planner decisions needed:** confirm no change to blocker taxonomy is intended.

### UX-CONV-05 — Teaching Load calm hierarchy

- **Objective:** Keep the allocation workspace; adopt the unified header, single primary action, and
  shared blocker card.
- **Owned paths (proposed):**
  - `atlas-client/src/pages/TeachingLoad.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - `atlas-client/src/components/faculty-assignments/TeachingLoadDraftActionBar.tsx`
  - focused tests
- **Dependencies:** UX-CONV-01, UX-CONV-02, UX-CONV-04.
- **Collision boundaries:** **DO NOT** touch the write/commit authority, suggestion apply, cap
  enforcement, or repair-queue semantics. This is a presentation stream; the live write path is a
  separate HIGH action.
- **Largest coherent one-shot scope:** header + toolbar + action-bar presentation only.
- **Acceptance evidence:** existing 61/61 authority suite and distribution/policy suites remain
  green; new presentation tests for the header/primary-action rule.
- **Live browser gate:** read-only Teaching Load desktop + mobile after a runtime deploy.
- **Planner decisions needed:** none beyond confirming no behavior change.

### UX-CONV-06 — Simple Timetable calm hierarchy

- **Objective:** Keep grid/placement/repair; adopt unified header and shared blocker/next-step
  presentation; preserve one-click clean placement + prominent Undo.
- **Owned paths (proposed):**
  - `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
  - the timetable header/rail presentation files (`LeftRail.tsx`, `LeftRailContent.tsx`,
    `CenterWorkspace.tsx`) — presentation only
  - focused tests
- **Dependencies:** UX-CONV-01, UX-CONV-02, UX-CONV-04.
- **Collision boundaries:** **DO NOT** change generation triggers, placement semantics, violation
  classification, or publish authority. Hard blockers must remain visible.
- **Largest coherent one-shot scope:** header + rail + feedback presentation; do not restructure the
  grid data flow.
- **Acceptance evidence:** timetable-focused suites green; tests asserting hard blockers remain
  visible and Undo still reverses a clean placement.
- **Live browser gate:** read-only grid at desktop + mobile; explicitly do not generate.
- **Planner decisions needed:** whether `RotationBanner` adoption for rotation subjects is in scope
  now or deferred.

### UX-CONV-07 — Faculty portal header/state unification

- **Objective:** Align faculty dashboard/schedule/preferences headers and state presentation with
  the unified contract.
- **Owned paths (proposed):**
  - `atlas-client/src/components/faculty-shared/FacultyGlobalHeader.tsx`
  - `atlas-client/src/pages/MyDashboard.tsx`, `MySchedule.tsx` (presentation regions)
  - `atlas-client/src/components/faculty-dashboard/*` and `faculty-preferences/*` presentation
    components
  - focused tests
- **Dependencies:** UX-CONV-01, UX-CONV-02, UX-CONV-04.
- **Collision boundaries:** **DO NOT** touch offline cache, room-preference write/outbox, or
  session/auth logic.
- **Largest coherent one-shot scope:** header + state components across the faculty portal.
- **Acceptance evidence:** existing resilience suites (9/9 at last integration) remain green;
  new header/state presentation tests.
- **Live browser gate:** faculty portal desktop + mobile, read-only.
- **Planner decisions needed:** none.

### UX-CONV-08 — Login/accessibility correction (SMART-informed ATLAS fixes)

- **Objective:** Apply the audit's accessibility lessons to ATLAS's own login/shell (not SMART).
- **Owned paths (proposed):**
  - `atlas-client/src/pages/Login.tsx`
  - `atlas-client/src/components/AppShell.tsx` (mobile menu accessible name only)
  - focused tests
- **Dependencies:** UX-CONV-01.
- **Collision boundaries:** must not change auth/session/token behavior or the EnrollPro bridge.
- **Largest coherent one-shot scope:** accessible names, focus order, and removal of any dead
  control discovered in ATLAS's login (verify before changing).
- **Acceptance evidence:** accessibility assertions (all controls have names; no `tabIndex={-1}` on
  actionable controls; no unhandled `href="#"`).
- **Live browser gate:** unauthenticated ATLAS login at both viewports (origin
  `https://njgrm.buru-degree.ts.net`).
- **Planner decisions needed:** whether ATLAS login parity work is worth a stream now or deferred.

---

## 3. Dependencies and locked successors

```
UX-CONV-01 (tokens/primitives)
   ├── UX-CONV-02 (header)
   │      ├── UX-CONV-03 (tables)
   │      ├── UX-CONV-04 (blockers/states)
   │      │      ├── UX-CONV-05 (Teaching Load)
   │      │      ├── UX-CONV-06 (Timetable)
   │      │      └── UX-CONV-07 (Faculty portal)
   └── UX-CONV-08 (login/a11y)
```

- **Locked successors (do not start):** any stream that changes scheduling authority, generation,
  publication, Teaching Load write paths, or suggestions — these remain behind their existing HIGH
  gates in the living register.
- **Locked by dependency:** 03–08 cannot start before 01 (and 02 where they consume the header).

---

## 4. Parallelization and collision map

| Lane | Streams | Shared files? | Notes |
|---|---|---|---|
| Lane A | UX-CONV-01 | `ui/**`, `index.css` only | Must finish before B–D. |
| Lane B | UX-CONV-02 | `smart/SmartPageShell.tsx`, page header regions | After A. |
| Lane C | UX-CONV-08 | `pages/Login.tsx`, `AppShell.tsx` | Can run beside B (disjoint files). |
| Lane D | UX-CONV-03 | `admin-workspace/AdminDataTable.tsx`, list pages | After B; disjoint from C. |
| Lane E | UX-CONV-04 → 05/06/07 | `SmartPageShell.tsx`, then one workspace each | After B; serialize 05/06/07 against each other only if they touch shared `SmartPageShell`. |

- `components/smart/SmartPageShell.tsx` is a **hot file**. Only one active stream may edit it at a
  time; the planner should sequence 02 before 04/05/06/07.
- `pages/Dashboard.tsx` is touched by 02 and 04 — sequence them or have one stream own both.

---

## 5. Acceptance evidence each stream must collect

1. Focused failing-first test proving the old pattern is gone (e.g. primitive no longer emits
   `zinc-*`; migrated page renders exactly one `h1` via the shared header).
2. Existing affected suites green (client type-check + build minimum; authority suites where the
   stream touches a workspace's presentation).
3. A grep/structural census for the specific drift the stream removes.
4. `git diff --check` clean.
5. Commit-based review boundary; executor returns `REVIEW_REQUIRED`.

## 6. Live browser gates (apply after a matched runtime is deployed)

- Origin must be exactly `https://njgrm.buru-degree.ts.net` for ATLAS browser evidence.
- Viewports `1366x768` and `390x844`.
- Each stream's migrated route must be exercised read-only at both viewports with a
  `window.location.origin` assertion and captured console/network outcomes.
- No stream may run its live gate on the shared runtime while another executor holds it.

## 7. Product decisions requiring the primary planner

1. **Header primitive naming/shape** — extend `SmartCommandBar` vs introduce `PageHeader`
   (contract recommends extending the existing primitive).
2. **First list wave** — which list pages enter UX-CONV-03 first if the planner wants a smaller slice.
3. **Rotation banner scope** — adopt SMART's three-term disclosure for Timetable rotation subjects in
   UX-CONV-06 or defer.
4. **ATLAS login parity** — whether UX-CONV-08 is worth doing now or deferring behind the scheduling
   critical path.
5. **Sequencing vs the live objective** — the register's current objective is a generated schedule
   with zero hard blockers; UX convergence is non-blocking and must not delay RR-TERM-CACHE-C01 or
   the runtime acceptance.

## 8. Items that must remain locked

- Live SMART is READ_ONLY; no stream may edit SMART or start/stop SMART processes.
- Live generation, publication, teaching-load apply/carry-forward apply, suggestion apply, and any
  database/migration apply remain separately gated HIGH actions.
- The shared `5001/5174` Tailnet runtime has one owner; UX streams use isolated ports until the
  planner schedules a bounded deploy.
- `CHANGELOG.md`, the living register, and runtime source-of-truth maps are integration-owner files;
  executors must not edit them.

## 9. Explicit authority statement

This handoff is planning input only. It does not authorize any ATLAS product change, dependency
change, schema change, data apply, deployment, generation, or publication. Every stream above must be
issued by the primary planner as a bounded executor packet with an accepted base SHA and owned paths
before any work begins.
