# ATLAS timetable UX evidence report

Run: 2026-09-28, 1366 x 768, authenticated existing **Your Brave** profile.

All page observations asserted `https://njgrm.buru-degree.ts.net`:
`/timetable` and `/timetable/manual-edit`. No `/login`, 502, blank page, publish, save, or generated test data occurred. The server did not restart during the run. Console errors/warnings: none observed.

Manual-action network evidence: the only non-GET timetable action request observed was `POST /api/v1/generation/1/10/runs/321/manual-edits/swap/preview`; no save/publish request was observed. Two `POST /api/v1/room-preferences/collaboration/ticket` requests were also observed while interacting. No schedule-save control was clicked.

## Ranked observed defects

Only observed defects are listed; this report is not padded to fifteen.

1. **MAJOR — DRAFT/MANUAL — Manual Edit opens without a selected class and leaves the schedule unusable until reload.**
   Repro: from `/timetable`, click `More` then `Manual edit` (2 clicks). `/timetable/manual-edit` settles on `No class selected for manual edit` and says to select a class on the schedule grid first. `Back to Schedule` returns to `/timetable` but retains the same no-selection panel instead of the grid; a hard reload is required to restore the grid. Observed: a menu entry that appears to start manual editing cannot carry the prerequisite selection into its destination. Expected: either disable/rename the entry until a class is selected, or preserve the selected class through the route. Timing: route completed in 1.14 s; reload to restore grid 1.65 s. Screenshot: unavailable (see `shots/README.md`).

2. **MAJOR — MANUAL — “Change room” silently does nothing.**
   Repro: on `/timetable`, click `TLE` at Mon 6:00 AM; click `More actions for selected class`; click `Change room` (3 clicks). Observed: after 3.27 s the selection and action bar disappear, no room picker/review/toast appears, and the grid remains unchanged. Expected: a room picker or an explicit explanation that no alternative room is available; the selected class should not silently disappear. Screenshot: unavailable (see `shots/README.md`).

3. **MAJOR — DRAFT — No visible way to start the requested draft from the rendered schedule.**
   Repro: inspect the rendered timetable header and `More` menu. Observed: header offers `Publish schedule`, while `More` offers `Manual edit`, `Swap sessions`, and other tools but no `Start draft`/`Create draft`. `Manual edit` produces defect 1 rather than a draft. Expected: an explicit draft state/action and a visible indication whether the displayed run is published, reviewable, or already a draft. Screenshot: unavailable (see `shots/README.md`).

4. **MAJOR — MANUAL — Move workflow exposes no valid empty slot in the visible schedule.**
   Repro: select TLE Mon 6:00 AM; click `Choose a new time for selected class` (2 clicks). Observed: all visible timetable targets are occupied; Health Break is explicitly blocked. Clicking the current target produces `Already in this slot. Choose another highlighted slot or cancel.` No visible empty target was available, so the requested drag-to-empty-slot action could not be performed. Expected: a scheduler can see at least one valid target, or receives a concise `No empty valid slots in this view` result and a clear exit action. Screenshot: unavailable (see `shots/README.md`).

5. **MAJOR — MANUAL — Swap review is blocked and gives conflicting task-state cues.**
   Repro: select TLE Mon 6:00 AM; `More actions for selected class` > `Swap with another class`; select Science Tue 6:45 AM (4 clicks). Observed after 0.56 s: a `Swap class times` review says `Checking options...`, then marks the target `Must fix: Section occupied: Luna, Room occupied: G7 Room 103 · G7AW, Faculty overlap: P. CRUZ`; `Swap sessions` is disabled. Closing/cancelling returns to an in-progress swap state that then required reload to clear. Expected: a conflict-safe swap may be disabled, but it should state the outcome plainly and have one reliable Cancel/Close path. Screenshot: unavailable (see `shots/README.md`).

6. **MAJOR — DRAFT/UNDO — Save/review/discard and Undo cannot be exercised from this UI state.**
   Repro: follow the Move and Swap paths above. Observed: no successful preview is produced, no draft/save/review/discard controls appear, and no Undo control appears. No test edit was persisted. Expected: after any valid manual preview, draft state, review, discard, and undo should be discoverable and testable; if no valid edit is possible, say so before entering the tool. Screenshot: unavailable (see `shots/README.md`).

7. **MINOR — HEADER — Technical/status wording creates an unclear operating state.**
   Repro: load `/timetable`. Observed: `Schedule information changed`, `Preview impact`, `Regenerate to apply`, `148 warnings`, and `Publish schedule` are simultaneously displayed. On a later reload the regenerate control changed from enabled to disabled (`Regenerate to apply — generation is not available`). Expected: plain status that identifies the schedule state, what changed, whether editing/publishing is safe, and the next permitted action. Screenshot: unavailable (see `shots/README.md`).

## Header evidence

Header rows above the grid: **4**.

1. Global shell: `Toggle Sidebar`; breadcrumb `Class Schedule`; notifications (4 unread); `Accessibility options`; `Active Term: T2`; `Active year: 2031-2032`.
2. Page/subnavigation: `Class Schedule`; `Schedule`; `Planning`; `Setup`; `Policies`; `Runs`.
3. Change notice: `Schedule information changed`; `Preview impact`; `Regenerate to apply`.
4. Schedule controls: `Term` / `Term 2`; `Show` / `Section`; `Schedule for` / `GR7 - Luna`; `Review warnings: 148 warnings`; `Publish schedule`; `More`.

Terms visible in the term picker: `All terms`, `Term 1`, `Term 2`, `Term 3`. View picker labels are `Section`, `Teacher`, and `Room` (not “Class”).

Older mouse-first scheduler clarity issues observed: `T2` is abbreviated in the global shell; `Schedule information changed` does not identify what is safe to do; `Preview impact` and `Regenerate to apply` are technical/ambiguous; `148 warnings` gives no immediate severity or consequence; `Publish schedule` appears beside a schedule-change warning; and the only direct-looking edit route (`Manual edit`) is hidden under `More` but fails without a preselected class.

## Manual-edit attempt log

| Offered action | Clicks to attempt | Feedback / result | Time to grid change | Outcome |
|---|---:|---|---:|---|
| Manual edit from More | 2 | `No class selected for manual edit`; return path kept that panel | 1.14 s route; 1.65 s reload to recover | Failed before draft |
| Select class | 1 | `Selected: TLE · GR7 - Luna`; `Nothing changes until you confirm` | 0.79 s | Selection only |
| Move via menu | 2, then current-target click | `Already in this slot. Choose another highlighted slot or cancel.` | <0.6 s feedback | No empty valid target observed; no move |
| Drag to empty slot | — | No empty target was rendered in the visible grid | — | Unperformed: no valid target |
| Swap | 4 | `Must fix` with section/room/faculty conflict; `Swap sessions` disabled | 0.56 s to review | Blocked; no save |
| Change room | 3 | No picker, toast, error, or visual change; selection disappeared | 3.27 s wait | Silent failure |
| Undo | — | No Undo control rendered because no edit was accepted | — | Unperformed |
| Save/review/discard draft | — | No draft was created; no controls rendered | — | Unperformed; no persisted change |

## Raw timing table

Usable means the timetable `<table>` was visible, not merely that a shell/skeleton had appeared. Wall-clock figures are measured from the UI action/hard reload to this state. Supported page evaluation did not expose Navigation Timing (`window.performance` was unavailable); the CDP request/finish trace was used for network duration. No request exceeded 1,000 ms in the three hard-reload samples.

| Operation | Sample | Target | Wall clock to usable | Network requests >1 s | Visual loading observation |
|---|---:|---|---:|---|---|
| Hard reload (`ignoreCache`) | 1 | `/timetable` | 1.615 s | None | No spinner/skeleton/blank observed at settled capture |
| Hard reload (`ignoreCache`) | 2 | `/timetable` | 1.549 s | None | No spinner/skeleton/blank observed at settled capture |
| Hard reload (`ignoreCache`) | 3 | `/timetable` | 1.555 s | None | No spinner/skeleton/blank observed at settled capture |
| Section switch | 1 | GR7 - Aguinaldo | 1.155 s | Not measured | No flash observed at settled capture |
| Section switch | 2 | GR7 - Rizal · SPA | 1.107 s | Not measured | No flash observed at settled capture |
| Section switch | 3 | GR7 - Luna | 1.009 s | Not measured | No flash observed at settled capture |
| Term switch | 1 | Term 1 | 1.153 s | Not measured | No flash observed at settled capture |
| Term switch | 2 | Term 3 | 1.044 s | Not measured | No flash observed at settled capture |
| Term switch | 3 | Term 2 | 1.004 s | Not measured | No flash observed at settled capture |
| View switch | 1 | Teacher — AGUILAR, CARLO MIGUEL · Adviser Bonifacio | 1.161 s | Not measured | No flash observed at settled capture |
| View switch | 2 | Room — G10 Room 401 · G1AW | 1.127 s | Not measured | No flash observed at settled capture |
| View switch | 3 | Section — GR7 - Luna | 0.990 s | Not measured | No flash observed at settled capture |

Loading-state limitation: the browser session supplied settled-state captures, so this is not a frame-by-frame assertion that no flash occurred between captures. There was no 502/blank route response, so the specified 60-second retry was not invoked.
