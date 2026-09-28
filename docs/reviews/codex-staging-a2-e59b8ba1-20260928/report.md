targets pass 0 / fail 9

## Target acceptance

| Target | PASS/FAIL | Evidence against the operator intent |
|---|---|---|
| D | FAIL | On `/timetable`, five hard reloads rendered the in-page error screen before any timetable grid, draft strip, Edit, Discard draft, or Publish control appeared. The requirement that edits land in a visible draft and update the grid could not be reached. |
| M1 | FAIL | No class grid rendered, so a class could not be selected and manual edit could not be reached. |
| M2 | FAIL | No selected class or Change room control rendered; no room picker/no-free-room message could be reached. |
| M3 | FAIL | No selected class, legal-target highlighting, Cancel control, or drag surface rendered. |
| M4 | FAIL | No swap entry point or outcome/Cancel behavior rendered. |
| M5 | FAIL | No draft edit could be made and no visible Undo control rendered. |
| H | FAIL | At 1366x768 the timetable header rendered 0 rows because the route terminated at the error screen. The required two-row maximum and one-sentence non-red change banner cannot be accepted. |
| T2 | FAIL | No timetable history or class-move history rendered. |
| T3 | FAIL | No timetable header rendered; `Run <n> · Draft`, More, and unchanged-run banner behavior could not be observed. |

## Ranked defects

1. **BLOCKER — LOAD — `/timetable` crashes before the grid is usable.**
   - Repro: In the existing authenticated Brave `Your Brave` profile, at 1366x768, open `http://127.0.0.1:5274/timetable`; hard reload with cache bypass. Repeated five times.
   - Observed: A loading message first appears: `Loading timetable: navigation is ready now; the grid fills as soon as the latest run resolves.` Within 0.95–1.12 s wall-clock, the page displays `This page hit an unexpected error` and `Minified React error #310`. No grid, selected section/term/view controls, draft state strip, history, or manual-edit control is rendered. Console captured the same React error, with a stack containing `ScheduleReviewWorkspace-zvLLQOF-.js:2:441824`.
   - Expected: The published timetable grid should become usable, then allow the requested section, term, view, draft, and manual-edit walk.
   - Timing: hard-reload wall-clock samples 1.116 s, 0.951 s, 1.071 s, 1.059 s, and 1.080 s; usable-grid time was not reached in any sample. Performance Navigation samples 3–5: 130.1 ms, 129.5 ms, and 127.4 ms document duration.
   - Screenshot: `S01-timetable-react310-error-1366x768.png` (captured final error screen).

Ranks 2–15 were not assigned. The primary scheduler route never rendered a grid, so lower-level header, draft, move, swap, room, undo, history, stale-grid, scroll, and count defects could not be observed without inventing results.

## Header evidence

`S01-timetable-react310-error-1366x768.png` is the available final-page screenshot; it contains the error screen, not a timetable header. Timetable header rows rendered: **0**.

Immediately before the crash, the loading shell exposed these controls/labels in reading order:

1. Toggle Sidebar
2. Class Schedule (breadcrumb)
3. Notifications, 4 unread
4. Accessibility options
5. Class Schedule (page heading)
6. Timetable sections: Schedule, Planning, Setup, Policies, Runs

There was no visible selected section, selected term, selected class/teacher/room view, run identity, published/draft state, or draft action. For an older scheduler, the missing state and action header means there is no way to understand what schedule is on screen or how to safely begin a draft.

## Draft and manual-edit walk

No draft was started. No timetable data was changed, saved, discarded, or published.

| Attempt | Clicks | Feedback / grid result | Result |
|---|---:|---|---|
| Start draft from published timetable | 0 | Published timetable grid did not render. | Not reachable |
| Drag a class to an empty slot | 0 | No grid rendered. | Not reachable |
| Swap two classes | 0 | No grid rendered. | Not reachable |
| Move via edit dialog/menu | 0 | No selected class or edit entry point rendered. | Not reachable |
| Undo | 0 | No draft edit or Undo control rendered. | Not reachable |
| Save/review/discard draft | 0 | No draft state or actions rendered. | Not reachable |

`draft doesn't work` at the route-load stage: the published timetable never reaches a rendered grid, so the UI never exposes the draft workflow.

## Raw timing table

Origin was asserted after every route/reload: `http://127.0.0.1:5274/timetable`. No production origin, `/login`, 502, or blank screen was observed.

| Operation | Sample | Wall-clock to terminal state | Performance Navigation duration | Grid usable? | Visible intermediate/final state | Requests over 1 s |
|---|---:|---:|---:|---|---|---|
| Hard reload, cache bypass | 1 | 1.116 s | not captured | No | Loading message, then React #310 error screen | `/api/v1/generation/1/10/readiness/diagnostic` — 1,062 ms |
| Hard reload, cache bypass | 2 | 0.951 s | not captured | No | Loading message, then React #310 error screen | none observed over 1 s |
| Hard reload, cache bypass | 3 | 1.071 s | 130.1 ms | No | Loading message, then React #310 error screen | none observed over 1 s |
| Hard reload, cache bypass | 4 | 1.059 s | 129.5 ms | No | Loading message, then React #310 error screen | none observed over 1 s |
| Hard reload, cache bypass | 5 | 1.080 s | 127.4 ms | No | Loading message, then React #310 error screen | none observed over 1 s |
| Switch section | 1–3 | N/A | N/A | No | Control unavailable because grid/header did not render. | N/A |
| Switch term | 1–3 | N/A | N/A | No | Control unavailable because grid/header did not render. | N/A |
| Switch view: class / teacher / room | 1–3 each | N/A | N/A | No | Controls unavailable because grid/header did not render. | N/A |

Notes: The first two measured reloads preceded direct Navigation Timing capture; the next three provide the requested browser Navigation Timing data. No skeleton was observed. The only intermediate content was the quoted loading message before the error screen.
