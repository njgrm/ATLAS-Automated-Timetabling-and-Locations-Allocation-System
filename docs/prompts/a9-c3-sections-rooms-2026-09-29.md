# A9 packet c3 — Sections and Campus & Rooms: problems first, one guided fix

Base: `origin/main` at launch. New branch `work/a9-c3-sections-rooms`, new worktree
`E:/ATLAS-worktrees/lane-a9-c3-sections-rooms` (never write in `D:\ATLAS`). Client only unless a bulk write needs
a server route (then reuse existing per-row routes in a loop first; a new route is HIGH and needs one
`atlas-reviewer-high` pass). Risk MEDIUM. Deadline: integrated on main by **2026-09-29 17:00**; demo Wed
2026-09-30. Loop: executor -> one fresh QA with REJECT_UX authority -> integration -> post `lane-a-to-c.md`.

Evidence: `docs/reviews/codex-staging-untouched-24e268fb/report.md` (Sections 3/2/3/2 and Campus & Rooms 3/2/3/3,
both REJECT_UX; top fixes 9 and 10). Older, mouse-first schedulers; never dense or intimidating; no tedium.

## Sections (`/sections`)
- "20 need rooms" sits beside 20 repeated "Choose home room" selectors. Replace with one guided step:
  "Give 20 sections a home room" -> ATLAS suggests a room for each (same grade wing first, free rooms only), the
  scheduler reviews the list in plain words and applies once; any row can be changed before applying.
- "Using saved data" / "last safe section mirror" / "Home-room edits can be queued" -> one plain line that says
  whether a click saves now.

## Campus & Rooms (`/map`)
- "78/103" -> "78 of 103 teaching rooms ready".
- Lead with problems, grouped by building ("Building C: 0 of 20 rooms can be used for classes — mark the teaching
  rooms"), each with its one fix. The full 103-room list goes behind "Show all rooms".
- Never dense at 1366x768.

## Rules
- Subtract: both pages end calmer and shorter.
- Browser proof via the Playwright MCP at 1366x768 on a preview from `scripts/dev/start-preview.ps1` against the
  staging API; before/after renders committed.
- Shell calls are force-killed at 20 min: run suites and builds detached and poll.
- Browser rows for Lane C: give all sections a home room in one reviewed step; Campus shows problems first.
