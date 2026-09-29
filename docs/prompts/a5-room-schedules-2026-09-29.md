# A5 packet c5 — Room Schedules: answer three questions without guessing

Base: `origin/main` at launch. New branch `work/a5-c5-room-schedules`, new worktree
`E:/ATLAS-worktrees/lane-a5-c5-room-schedules` (never write in `D:\ATLAS`). **Client only**, unless a missing read
endpoint forces a server change (then stop and post to Lane C first). Deadline: integrated on main by
**2026-09-29 17:00** for the evening release; demo Wed 2026-09-30. Risk MEDIUM. Loop: executor -> one fresh QA
with REJECT_UX authority -> integration -> post `lane-a-to-c.md` with browser rows.

## Operator direction (09:45)
"We need to change room schedules as well since it's confusing right now." Older, mouse-first schedulers; never
dense or intimidating; no guesswork or tedium.

## Today
`pages/RoomSchedules.tsx` (814 lines, untouched since 09-26; routes `/room-schedules` and `/schedules`): a "How to
browse schedules" panel, a **"Generation run ID"** number input ("Use a whole number above 0."), separate
"Schedule view term" and "Schedule download term" pickers, and room/teacher/section browsing.

## The target: each of these answered in at most 2 clicks from landing
1. "What is in **Room 101** on Tuesday?"
2. "Where is **this teacher** at 10:00 on Monday?"
3. "What is **Grade 7 – section X**'s week?"

- One row at the top: `Show: [Room | Teacher | Section]`, then one searchable picker of names. The week grid below
  (Mon–Fri, readable at 1366x768 without horizontal scroll), with cells in plain words (subject, section or
  teacher, room).
- The schedule shown is always the **latest usable timetable** for the active term, picked automatically, with one
  quiet line saying which ("Showing the timetable made on 29 Sept"). **No run id input on screen.** If an older
  timetable must stay reachable, put it behind a small "Show an older timetable" link listing dates, not ids.
- At most one term control, and only if the active school year really has terms that differ.
- One button, "Print this schedule", for what is on screen.
- Empty and failure states say what happened and give one next step ("No timetable yet — build one on the
  Timetable page", with the link).
- Same filter look as your Subjects c4 shared filter style.

## Rules
- Subtract: the page ends shorter and calmer than today; drop the "How to browse" panel if the page explains
  itself.
- Browser proof via the Playwright MCP at 1366x768 on a preview from `scripts/dev/start-preview.ps1` against the
  staging API: the three questions answered, renders committed.
- Shell calls are force-killed at 20 min: run suites and builds detached and poll the log.
- Browser rows for Lane C: the three questions with click counts; no "run id" text anywhere; print opens.
