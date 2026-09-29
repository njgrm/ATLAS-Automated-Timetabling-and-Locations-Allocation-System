# fix-1.2 (operator follow-ups to 1.1) — split across A5, A6 and A9

Issued by Lane C, 15:10. Source text: `docs/reviews/fix-1.2-status-20260929/fix-1.2.txt` (from `D:\ATLAS\fix-1.2.docx`).
Status (Codex + Lane C cross-check): `docs/reviews/fix-1.2-status-20260929/codex-report.md`. Deadline: on main by
**18:00** (evening train). Each lane: new branch/worktree from the main tip; executor -> one fresh QA with REJECT_UX
authority -> integrate -> post `ready for release`. **Browser proof with REAL staging data** (staging QA login).
**Clickable must look clickable** (planner rule). Shell calls are force-killed at 20 min; builds at BelowNormal.

## A5 — shared UI + Subjects
- **24.2** `/teachers` header button reads exactly `+ Create temporary teacher (Teacher X)` — a literal capital X, not the
  next roster number (`rosterActionLabels.ts:52-56`, `Faculty.tsx:666`).
- **35.1** Tooltips: `src/ui/tooltip.tsx:40` forces `whitespace-nowrap`; make shared content wrap
  (`w-max max-w-xs md:max-w-sm whitespace-normal break-words leading-normal`, collision padding 8), keep the Portal
  and z-50. Verify every quick-filter pill on `/teachers` (No subjects assigned, Above weekly max, No sections assigned,
  Temporary teachers, All teachers) shows its full sentence at 1366.
- **23.2** Universal resizable data/form dialogs: a `resizable` prop on the shared dialog (default true for data/form,
  false for confirm/alert, which stay compact `max-w-md`), centered by a flex parent, width drag handles, clamps
  `min-w-[480px] max-w-[95vw] max-h-[85vh]`. Apply to Subject coverage, Teacher profile, Assign teaching load, Assign
  Home Room, Create temporary teacher. Coordinate with A6 c9 (Load summary dialog) via `lane-c-to-a2.md`.
- **17.2** Subject coverage chips (`SubjectCoverageSheet.tsx:260-263`): pill `px-3 py-1.5 gap-2 rounded-xl`, grade badge
  `text-xs font-semibold px-2 py-0.5` keeping grade colours, section name `text-sm font-medium`; chips wrap as the
  dialog widens.

## A6 — already in `a6-c9-staffing-percent-2026-09-29.md` (addendum 15:05): 38.1 (keep both) and 16.2 (card layout).

## A9 — Campus & Rooms
- **7.2** Room readiness pills become filter buttons: All rooms (default) / Ready / Needs attention / Unavailable, with an
  obvious active state; rooms always in natural name order (G10 Room 101, 102 … 201); empty state "No rooms currently
  marked as Needs attention." (`RoomReadinessList.tsx:202-235, 286`).
- **10.2** Building details: room names wrap instead of `truncate` (`CampusMapOverview.tsx:722`, also check
  `BuildingView.tsx:834`); utility bar and drawing surface get `px-4 md:px-6` inset so the zoom pill and legend text
  do not touch the borders.
- **36.2** (stretch, only after 7.2 and 10.2 are on main) Editor canvas grows in all four directions: centered world,
  prepend-and-translate on left/top with scroll compensation so nothing jumps (`campusEditorCanvas.ts:164-166` clamps
  to zero today).
