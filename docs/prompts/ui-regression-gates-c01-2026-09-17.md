# UI-REGRESSION-GATES-C01 - the three gates that would have caught tonight's crashes

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **MEDIUM**
(tooling, config, and test additions; no product behaviour change).

## Why

Two live defects reached the deployed release with no gate objecting:

- `/timetable` throws React **#310** because `armSwapSessions` (`useCallback`,
  `ScheduleReviewWorkspace.tsx:247`) is declared **after** the early returns at
  lines 176/180/203. That is the canonical `react-hooks/rules-of-hooks` violation.
- The "review load" view throws `Cannot read properties of null (reading
  'remainingHours')` because `TeacherGridMode.tsx:56` types `loadProfile` as
  **`any`** and dereferences it unguarded at `:533/:567`, while
  `TeachingLoad.tsx:406` already proves the value is nullable by using `?.`.

There is no ESLint in this repository, `vite build` does not type-check, and no
acceptance matrix ever loaded a product page.

## Scope

### G1 - ESLint with the React Hooks plugin

- Add a flat `eslint.config.js` at the repo root with `typescript-eslint` and
  `eslint-plugin-react-hooks`.
- `react-hooks/rules-of-hooks` = **error** (this is the rule that catches #310).
- `react-hooks/exhaustive-deps` = **warn**.
- `@typescript-eslint/no-explicit-any` = **error**, with a checked-in baseline of
  the existing offenders so the wave does not balloon. The baseline is a
  **ratchet**: the count may only decrease. Current known sites include
  `TeacherGridMode.tsx` (`loadProfile`), `CenterWorkspace.tsx` (10 props),
  `RightPanel.tsx` (6 props), `ViolationsSidebar.tsx` (`panelRef`), and
  `timetableContexts.types.ts` (`kbSelectedSource`).
- Add a `lint` script and wire it into the standard gate sequence.

### G2 - Client type-check

- Add a `typecheck` script to `atlas-client` running `tsc --noEmit` against its
  `tsconfig.json`, and include it in the standard gate sequence. The server build
  already runs `tsc`; the client has no static gate.

### G3 - Route smoke crawl

- A Playwright spec (reuse the existing `test:visual` harness and config) that:
  1. loads every route declared in `App.tsx` (`/`, `/subjects`, `/teachers`,
     `/teaching-load`, `/teaching-load/history`, `/faculty`, `/assignments`,
     `/sections`, `/faculty/preferences`, `/timetable`, `/room-schedules`,
     `/schedules`, `/map`, `/audit`, `/admin/year-setup`, plus the public routes);
  2. opens each page's primary **non-mutating** controls and closes them;
  3. **fails** on any `pageerror`, any React render error, or any unexpected
     response `>= 400`.
- Apply a generous deny-list so no control that writes can be triggered (no
  save/apply/submit/generate/publish/delete/sync/archive/rollover/carry/assign).
- Allow-list the documented benign 404s (no current generation run; no room
  preferences yet) so the spec fails only on genuine regressions.

### G4 - Report the baseline

Record, in the evidence: the current lint violation count by rule, the client
`tsc` result, and the smoke spec's per-route result. These become the ratchet
baseline for every later lane.

## Acceptance

| # | Row | Pass condition |
| --- | --- | --- |
| 1 | Lint config loads | `npm run lint` executes and reports the recorded baseline |
| 2 | **Failing-first: rules-of-hooks** | a fixture component with a `useCallback` after an early return makes lint exit **nonzero** |
| 3 | **Failing-first: no-explicit-any** | a fixture with a new `any` typed prop makes lint exit **nonzero** |
| 4 | Client type-check | `tsc --noEmit` runs and exits 0 at the current tree |
| 5 | **Failing-first: the live site** | pointed at `https://njgrm.buru-degree.ts.net` as deployed **today**, the smoke spec must **FAIL** and name `/timetable` (React #310). This is the decisive control: the gate must have teeth against the exact defect it exists to catch |
| 6 | Smoke spec passes once fixed | after `TT-RENDER-FIX-C01` ships, the same spec passes on all routes |
| 7 | No write triggered | before/after signatures prove the crawl mutated nothing (no audit rows, no run/ownership change) |

Row 5 may be run in a reduced form if the crawler must point at an isolated build;
if so, record it as an isolated-control run and keep the live row `DEFERRED` until
after the next deployment.

## Forbidden

Do **not** fix the product defects here - they belong to `TT-RENDER-FIX-C01`.
Do not weaken a rule, widen an allow-list, or add an ignore entry to make a gate
pass; a suppressed violation must instead be added to the ratchet baseline with
its rationale. No product source, runtime, task, env, database, or companion
change.

## Deliverable

One evidence document under `docs/reviews/ui-regression-gates-c01/`: the config
diff, the two rule fixtures with their nonzero exit codes, the client
type-check result, the per-route smoke result **including the failing-first run
against the live deployment**, the recorded baseline counts, and the zero-write
proof.

## Sequencing

Land this lane **before** `DIRECTIVE-REVISION-R1`, so the directive change ships
with the gates' evidence attached.
