# TIMETABLE-UX-REHAUL-C01R — the relaxed Simple shell (one status, one primary, persistent sub-nav)

**Status:** `PREPARED`. The program is authorized end to end by
`docs/prompts/timetable-ux-rehaul-oneshot-2026-09-21.md` (standing authorization; every gate
retained). This packet is the implementation spec for the remaining gap between the live page and
that program's U1–U6 bar.
**Risk:** MEDIUM client source. The release that carries it is HIGH.
**Owner:** Lane A (primary planner). The planner provisioned the executor worktree:
`E:/ATLAS-worktrees/timetable-ux-rehaul-c01`, branch `work/timetable-ux-rehaul-c01`.

---

## 0. Live evidence that scopes this packet (2026-09-21, release `ecff1d7e`, one authorized login)

Read-only browser pass at `https://njgrm.buru-degree.ts.net/timetable`, 1366×768,
`window.location.origin` asserted, audit row **862** (actor 46). Findings that decide the scope:

- **U2 fails.** Four stacked status surfaces render in the Simple state: the amber `SimpleDriftBanner`;
  the source/readiness/controls row; the `timetable-hidden-row-controls` row; and the
  `timetable-simple-task-prompt` "NEXT STEP" card. **Two filled/solid primary buttons** render in the
  same state (`Publish schedule`, `Review warnings`) plus an outline `Generate`.
- **U3 fails.** **No persistent sub-nav exists.** On every `/timetable*` route the only
  `a[href^="/timetable"]` is the sidebar `Class Schedule`. `/timetable/setup`, `/timetable/runs` and
  `/timetable/exports` are reachable **only by typing the URL** — no UI affordance links to them
  (`git grep '/timetable/setup|/timetable/runs|/timetable/exports'` finds only route definitions,
  comments and tests). Breadcrumbs do render on sub-pages (`Class Schedule / Setup`), but the
  ancestor is not a link and the index renders a single crumb.
- **U6 passes** — `documentElement.scrollHeight == clientHeight == 768`, `window.scrollY == 0`.
- **U4 baseline** — a clean `/timetable` load issues **19 API GETs and zero non-GET**; in-app route
  moves to sub-pages issue **0–3 GETs** and never refetch the grid (the TanStack cache works).
  **Do not regress this.**
- **U5** — the warning surface already carries identity + unit-bearing numbers
  (`FERNANDEZ, JANELLA MARIE has 180 consecutive teaching minutes on Monday, exceeds limit 135
  minutes.`). Build on it; do not re-fix it.
- **F-07 persists** — the cell detail renders `P. CRUZ · G7 Room 103 · G7AW`, repeating the grade.
- **No `h1`** renders on the page (`h1Count == 0`).

## 1. Deliverables

### D1 — persistent sub-nav (the U3 spine; highest value)
Render one visible sub-nav inside the `/timetable` shell, present on **every** `/timetable*` route
including the index: `Schedule` (`/timetable`), `Setup` (`/timetable/setup`),
`Policies` (`/timetable/policies`), `Runs` (`/timetable/runs`), `Exports` (`/timetable/exports`).
- Use react-router `NavLink` with a real active state; `@/ui` primitives only; no native `<select>`.
- It must **not** remount the workspace or issue a grid refetch. The routes are already
  element-less children of the mounted `/timetable` route (`atlas-client/src/App.tsx:159-183`); the
  sub-nav is the missing entry point, not a new route tree.
- New component `atlas-client/src/components/timetable/TimetableSubNav.tsx` (≤ 150 lines), rendered
  by the shell so it shows on the index **and** every sub-page. Give it
  `data-testid="timetable-sub-nav"` and per-item `data-testid="timetable-sub-nav-<key>"`.

### D2 — one status region
Consolidate the drift banner, the readiness chip, the hidden-row controls and the NEXT STEP card
into **one** status region that states the single most important thing in plain language and offers
the single next action. Everything else is disclosed through `@/ui` `Popover`/`Tooltip` — no raw
`<details>`, no `title` attributes.
- Keep the two **mutually exclusive** `data-testid="timetable-simple-task-prompt"` blocks (the
  no-run state and the has-run state): they are the two states of the single status region. Do
  **not** collapse them into one block.
- Keep the drift repair actions (`Fix Rooms`, `Preview impact`, `Sync with setup`) and the
  hidden-row chip / `Show full day` control reachable from the region; disclosure is fine.
- Keep exactly one `SimpleFilterControls`, keep `SimpleActiveFilterChips`, keep
  `SimpleReadinessChip`, and keep the ≥ 0.75rem typography floor in the Simple chrome.

### D3 — one primary action per state
Exactly **one filled/solid** action in the header at any time, derived from the lifecycle state.
- `SimpleGenerateAction` and `SimplePublishAction` stay rendered and reachable **without** opening
  More (the UX-QUICKFIX-C01 contract) but become **secondary/outline** so neither can be a second
  solid primary. Do **not** change their gating, `aria-label`, or dispatch guards.
- Remove the `ChevronDown` false affordance from the primary action button (audit F-18): the primary
  dispatches an action, it does not open a menu. Keep a chevron only where the control genuinely
  opens a menu.

### D4 — cell density (F-07)
In the grid cell detail (`atlas-client/src/components/timetable/TimetableGrid.tsx`), stop repeating
the grade: render teacher + room + section code once (`P. CRUZ · Room 103 · G7AW`) with the full
string available through an `@/ui` `Tooltip`. Do not change the cell's data, selection behaviour or
testids.

### D5 — page heading (lowest priority; do last)
Add one visible `h1` naming the current Timetable surface, using the existing shared
`atlas-client/src/components/app-shell/PageHeader.tsx` anatomy (promote, do not rewrite) or an
equivalent `@/ui`-styled heading. Keep the no-scroll architecture.

## 2. Boundaries — do not break
- **Client source only.** Changed paths are limited to `atlas-client/**` plus the `package.json`
  test-script entry. **No** server, DB, migration, generation, publication, deployment, runtime, or
  companion-repo change.
- **No-scroll architecture:** root `flex flex-col h-[calc(100svh-3.5rem)]`; inner scrollers
  `flex-1 min-h-0 overflow-auto`. `documentElement.scrollHeight == clientHeight` at 1366×768.
- `ScheduleReviewWorkspace.tsx` `buildScopeKey`/`clearScopeState` scope hygiene survives unchanged.
- Ordered-term identity, actor-school scope and the strict publication predicate are untouched.
- shadcn/Radix primitives only; 0 native `<select>`; no raw unstyled `<button>`; no raw `<details>`.
- **1000-line component cap.** `TimetableSimpleHeader.tsx` is 931 lines — extract sub-components
  before you exceed it.
- Route paths and URLs unchanged.

## 3. Test gates (run these; paste the literal results into the handoff)

Run from `E:/ATLAS-worktrees/timetable-ux-rehaul-c01/atlas-client`:

1. `npm run typecheck`
2. `npm run build`
3. `npm run test:timetable-route-keys` (the nested-route/outlet-keying preservation suite)
4. `npm run test:timetable-operator-ux`
5. `npm run test:ux-guardrails`
6. `npm run test:warning-readability`
7. `npm run test:timetable-ux-rehaul` — **new script you add to `atlas-client/package.json`**

**Add the new gate in the same commit.** `test:timetable-ux-rehaul` must run:
- a new `atlas-client/src/lib/__tests__/timetable-ux-rehaul-c01.test.ts` (or `.tsx`) that decides
  D1–D4 as production-path proof — render the real `TimetableSimpleHeader` / `TimetableSubNav` with
  an injected context (not a helper), and assert: the sub-nav exists with its five links; exactly
  **one** filled primary renders per state; the cell detail no longer repeats the grade; and the
  single status region is the only top-level status surface. **This test must fail on the base
  commit** — record that failing-first run.
- the three currently **orphaned** UX suites, which no committed script runs today:
  `src/lib/__tests__/ux-r02-simple-stripdown.test.ts`,
  `src/lib/__tests__/ux-quickfix-c01-header-actions.test.ts`,
  `src/lib/__tests__/ux-r01-shared-chrome.test.tsx`.

**Test-change rule.** Prefer to keep those three suites passing unchanged. If a redesign genuinely
changes the structure an assertion encodes, **update it additively**: keep every assertion whose
intent still holds and add an equivalent for the new structure — never delete an assertion to make a
finding go away (`AGENTS.md` §16). Say exactly which assertions changed and why in the handoff.

**Fixtures come from the real surface** (`AGENTS.md` §11). Copy the strings the live page actually
renders; do not invent a fixture that already contains the correct text.

## 4. Evidence the executor must return (one page)
- Base SHA · candidate SHA · exact changed paths.
- What changed and why, per deliverable D1–D5.
- The literal command and result for each gate in §3, including the failing-first run of the new
  suite on the base commit.
- Known risks, each marked `BLOCKING` or `NON_BLOCKING`.
- Verdict: `REVIEW_REQUIRED`.
