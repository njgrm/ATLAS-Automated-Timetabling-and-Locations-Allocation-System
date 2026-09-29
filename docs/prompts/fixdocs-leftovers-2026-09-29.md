# Fix-doc leftovers on live 3216d383 — small, fast, one candidate per lane

Issued by Lane C, 13:05. Evidence: `docs/reviews/codex-live-fixdocs-3216d383/report.md` (Codex, live, read-only).
Items come from the operator's `fix-1.1.docx` / `fix-2.docx`. Deadline: on main by **15:30** (train 10).
Each: new branch + worktree from the main tip; executor -> one fresh QA -> integrate -> post `ready for release`.
**Browser proof with REAL staging data** (see "Real staging data in previews" in `.opencode/agents/atlas-planner.md`).
Shell calls are force-killed at 20 min.

## A6 (Teaching Load / Subjects coverage)
- **39** `/teaching-load` toolbar still has a pop-up **"More filters"**. Fix-doc asks: search of sensible width, a sort
  choice and direct toggles, no More-filters menu. Move its filters to direct controls (at most two), drop the rest
  or fold them into the sort/toggles. Keep one row at 1366.
- **17.1** `/subjects`: clicking a coverage count (e.g. **"ESP/GMRC coverage: 18/20 sections"**) opens nothing. It must
  open the subject's coverage window (which sections have a teacher, which do not), read-only, plain words.
  If the Subjects file is A5's, coordinate via `lane-c-to-a2.md`; A5 is on Room Schedules.

## A9 (Campus & Rooms)
- **36** `/map` -> Edit map: the right-hand panel covers the **Grade 10 Academic Wing** card. No building may sit
  under the panel at 1366x768 (fit the canvas to the free area, or make the panel collapse).
- **37** `/map` overview: remove the helper line "Select a building on the map to inspect rooms, or review room
  readiness below." if A9 c3 (`fc`/train 9) did not already; confirm which.
