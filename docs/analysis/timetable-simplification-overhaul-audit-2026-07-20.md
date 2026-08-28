# Timetable Simplification Overhaul Audit - 2026-07-20

## Trigger

The current timetable page still feels overwhelming, and the user reports that generated unassigned sessions cannot be placed and sessions cannot be swapped reliably.

This audit intentionally checks the actual live interaction contract, not only the previous Playwright gates. The earlier gates proved that review surfaces could open, but many of them blocked live writes and did not prove that a normal operator could complete placement or swap from the visible UI.

## Live Environment

- Target: `https://njgrm.buru-degree.ts.net`
- Login: Admin `1000001`
- Runtime context: persisted ATLAS evidence, active `schoolYearId=39`, stale upstream context.
- Latest completed timetable source observed by `/timetable`: run `223`.

## Findings

### 1. Generated unassigned placement is not actually available for the current run

Latest run `223` exposes:

- `365` generated unassigned items.
- `365 / 365` have `facultyId`.
- `0 / 365` have `homeRoomId`.
- `360` are `FACULTY_OVERLOADED`.
- `5` are `NO_COMPATIBLE_ROOM`.

The client placement path for generated unassigned sessions requires both:

- `targetFacultyId`
- `targetRoomId`

The current client code builds `targetRoomId` from `item.homeRoomId`. Because every observed generated unassigned item has `homeRoomId=null`, the visible generated placement path cannot commit a placement for this run.

### 2. The visible `Place session` button routes to the wrong mental model

In the generated unassigned rail, the visible `Place session` action currently opens the Tactical Sandbox / Teaching Load repair dock instead of starting a simple "choose a cell and review placement" flow.

Live audit evidence:

- Clicking a generated unassigned row shows grid-wide guidance.
- Clicking the row's `Place session` button opened a `Fix Teaching Load Owner` dialog.
- No placement commit request was attempted after clicking `Place session`.

This is misleading because the button says "Place session" but behaves like "Repair owner/suggestions."

### 3. Grid guidance exists, but the final action is unclear

Selecting an unassigned item did show grid-wide labels such as:

- `Warning`
- `Blocked`

However, clicking a grid cell after selecting the generated unassigned source did not attempt a generated placement commit in the live audit. The UI therefore communicates possible slots but does not complete the expected user journey.

### 4. Swap reaches the write endpoint, but the UI language is confusing

Generated occupied-slot swap did open `Review occupied-slot swap`.

Live audit evidence:

- `Direct swap` was selectable.
- `Apply repair` attempted `POST /api/v1/generation/1/39/runs/223/manual-edits/swap`.

So the swap path appears technically reachable, but its final button says `Apply repair`, not `Swap sessions`. For a non-technical scheduler, that creates unnecessary uncertainty.

### 5. The page still opens as a cockpit, not a guided workspace

The initial page still exposes too much at once:

- run selector
- refresh
- publish
- plan before generating
- more tools
- statistics
- task strip
- section selector
- filters
- violations rail
- unassigned rail count
- requests tab
- many violation rows
- grid

Live initial button text showed `Violations 213`, `Unassigned 365`, and many detailed violation rows visible on first load. This is still visually and cognitively heavy.

### 6. Previous verification was insufficient

The earlier Phase 1-6 matrix proved that:

- dialogs opened,
- no obsolete teacher/room modal appeared,
- visual labels rendered,
- no global scrollbar appeared,
- non-preview writes were blocked.

It did not prove that:

- generated unassigned placement can commit from the primary visible action,
- generated unassigned data contains a usable room source,
- a normal user can understand whether they should repair, place, or regenerate,
- the page is simple enough for older non-technical users.

## Root Cause Summary

The current page is trying to combine four products into one screen:

1. timetable review,
2. unassigned recovery,
3. teaching-load repair,
4. diagnostics/policy/setup tools.

The current implementation also mixes data readiness states with placement actions. It exposes `Place session` even when the item lacks the `targetRoomId` required to place.

## Immediate Product Decision Needed

Generated unassigned items without `homeRoomId` need a clear product contract:

- either ATLAS must derive the room automatically from section/home-room truth before placement,
- or the UI must label the action as `Fix room first` / `Open room readiness`,
- or the placement review must include a simple room-source selector that defaults to section home room without reintroducing timetable-owned teacher assignment.

The current middle state is invalid: the UI says `Place session`, but the data cannot be placed.
