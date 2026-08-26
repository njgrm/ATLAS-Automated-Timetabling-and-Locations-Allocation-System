# Cross-Page Header Density and Source-Truth Audit - 2026-07-20

## Trigger

The timetable overhaul cannot be treated as isolated UI work. The same visual-density problem appears across the setup pages used before scheduling: Sections, Subjects, Teachers, and Teaching Load.

The user also reported that the saved data shown now differs from the previous EnrollPro-sourced saved data. This audit checks the live Tailnet runtime source resolver and the rendered page geometry.

## Live Environment

- Target: `https://njgrm.buru-degree.ts.net`
- Login: Admin `1000001`
- Viewport measured: `1366x768`
- Date checked: `2026-07-20`

## Rendered Layout Findings

The app shell header itself is consistent at `56px`. The failure is the page-local header area below the shell: page title, description, source badge, stat pills, primary actions, and toolbar/filter rows are stacked vertically before the useful table/grid starts.

| Route | First useful content observed | Top offset | Header share of viewport | Finding |
|---|---:|---:|---:|---|
| `/timetable` | Timetable grid scroll area | `290px` | `37.8%` | Too much run/status/task chrome before the grid. |
| `/sections` | Sections table | `315px` | `41.0%` | Header and toolbar consume almost half the viewport before rows. |
| `/subjects` | Subjects table | `355px` | `46.2%` | Subject controls and header leave the table too low. |
| `/teachers` (`/faculty` redirect) | Teachers table | `425px` | `55.3%` | Worst offender; more than half the viewport is consumed before rows. |
| `/teaching-load` | Workspace body after local toolbar | about `350px` from code/live block evidence | about `45%` | The toolbar card, workflow steps, and action/status controls stack too tall. |

## Source Code Locations

- `atlas-client/src/components/admin-workspace/AdminWorkspace.tsx`
  - `AdminWorkspaceFrame` renders the shared setup-page header.
  - Current pattern: `px-6 py-4`, stacked `title + description`, `source chip + stats`, separate primary action row, and a padded toolbar card.
- `atlas-client/src/pages/TeachingLoad.tsx`
  - Uses a custom `shrink-0 px-6 py-2` header with `WorkspaceToolbar`, workflow instruction copy, and optional incident banner.
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - Uses a card-like rounded toolbar with title, status, coverage stats, mode controls, and actions.
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
  - Timetable still spends too much vertical space on run controls, task guide, filters, and status before the grid.

## UX Assessment

### What is failing

- The pages are technically no-scroll, but the useful work area is starved.
- The shared setup-page frame optimizes for explanatory copy and status completeness, not table-first work.
- Most users opening these routes want to scan and act on rows; the table is visually delayed.
- Older non-technical users are made to parse several badges and action rows before seeing the data they came for.
- The source-status wording is present but not enough to explain why the current data differs from old EnrollPro-backed data.

### Desired compact-shell contract

- The page-local header should fit in a single compact command band whenever possible.
- The first useful table/grid should start no lower than `220px` on a `1366x768` viewport.
- The table/grid body should own at least `65%` of the viewport height on laptop screens.
- Detailed source explanations should move behind a tooltip, popover, or details sheet.
- Primary actions should stay visible but stop creating extra vertical rows.
- Filters should remain behind a `Filters` popover unless actively opened.

## Runtime Source-Truth Findings

The current runtime resolver does not match the older EnrollPro-backed setup dataset.

### Current live resolver output

`GET /api/v1/runtime/context?schoolId=1`

- `activeSchoolYearId`: `39`
- `source`: `atlas-persisted`
- `stale`: `true`
- `upstream.reachable`: `false`
- `upstream.verified`: `false`

`GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`

- Still returned `activeSchoolYearId=39`.
- Took about `4023ms`.
- Upstream remained unreachable.

### Evidence mixed across school years

The runtime resolver returned evidence for both school years:

- `generation-run`: `schoolYearId=39`, timestamp `2026-07-13T11:42:30.775Z`
- `section-mirror`: `schoolYearId=39`, timestamp `2026-07-13T08:20:44.026Z`
- `section-snapshot`: `schoolYearId=39`, source `atlas.section_snapshot:enrollpro`
- `scheduling-policy`: `schoolYearId=39`
- `faculty-snapshot`: `schoolYearId=55`, timestamp `2026-05-27T18:07:44.618Z`

### Dataset contrast

`GET /api/v1/sections/summary/39?schoolId=1`

- `20` sections.
- `0` total enrolled.
- Many sections lack `homeRoomId`.
- Fetched from saved ATLAS mirror evidence dated `2026-07-13`.

`GET /api/v1/sections/summary/55?schoolId=1`

- `82` sections.
- `3565` total enrolled.
- Many sections have `homeRoomId`.
- Fetched from saved ATLAS mirror evidence dated `2026-05-28`.

This is the practical reason the saved data looks different: the UI is resolving the current runtime to school year `39`, while the older EnrollPro-backed working dataset was school year `55`.

### Timetable run clarity

`GET /api/v1/generation/1/39/runs?limit=5` shows newer failed runs above the latest completed run:

- run `225`: `FAILED`
- run `224`: `FAILED`
- run `223`: `COMPLETED`

`GET /api/v1/generation/1/39/runs/latest/draft` correctly resolves the latest completed draft payload to run `223`:

- `560` assigned entries.
- `365` unassigned items.
- `365 / 365` unassigned items have a faculty owner.
- `0 / 365` unassigned items have `homeRoomId`.

The page must not let a run label, selector, or status chip imply that a failed run is the usable timetable source when the visible grid is actually backed by the latest completed draft.

## Why The Saved Data Differs From The Previous EnrollPro-Sourced Data

ATLAS is currently using a stale ATLAS-persisted runtime context because live EnrollPro verification is unavailable. The resolver is selecting the newest local scheduling evidence for school year `39`, while older known-good EnrollPro-derived sections/faculty/generation evidence still exists under school year `55`.

This is not just a display issue. It changes the data universe used by setup pages and `/timetable`:

- Sections become `20` instead of `82`.
- Enrollment appears as `0` instead of `3565`.
- The latest timetable run is under `schoolYearId=39`.
- The run list includes newer failed runs above the completed draft currently backing the grid.
- Generated unassigned items in the active run lack `homeRoomId`, which blocks placement.

## Required Product Fix

ATLAS needs a visible and enforceable source-truth decision before further timetable simplification is considered complete.

The next phase must either:

1. intentionally lock the current workspace to school year `39` and explain that it is a stale saved snapshot, or
2. restore/resync the intended EnrollPro-backed school year `55` dataset and make that the active scheduling context, or
3. provide an operator-visible school-year/source selector that prevents silent cross-year drift.

The current middle state is not acceptable: the app quietly uses school year `39` while users expect the previous EnrollPro-sourced data that existed under school year `55`.

## Recommended Gate Additions

- Add a live Playwright layout-budget test for `/timetable`, `/sections`, `/subjects`, `/teachers`, and `/teaching-load`.
- Fail if first useful content starts below `220px` on desktop unless a blocking alert is present.
- Fail if the route creates global scrollbars.
- Add an API source-truth gate that records runtime context, upstream verification status, and section-summary counts for the resolved school year.
- Fail timetable placement gates when the active run's unresolved items lack the room source needed for placement.
