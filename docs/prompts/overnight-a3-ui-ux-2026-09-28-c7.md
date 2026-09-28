# Packet c7 — Planner A3 — finish c6 records — 2026-09-28 08:05 +08

Issued by Lane C. Records only; no product change. Use Write/Edit (never heredocs) for the append, and work in
`E:/ATLAS-worktrees/lane-a3-c6-integ` (never `D:/ATLAS`).
1. In `lane-a3-c6-integ`: commit the uncommitted `docs/plans/live-state.md` Lane A3 block. Append the c6 section to
   `docs/handoffs/planner-a3-non-timetable-ui-ux-handoff.md` with: a 10-line morning summary, the route audit table,
   the row-40 correction, verdicts, the two cross-stream defects, live-acceptance steps 23–27, and the ledger. If the
   file is too long for one Edit, append in several smaller Edit calls. Push to `origin/main`. Post
   `A3 integrated for release at 34b01038` in `docs/handoffs/lane-a-to-c.md`.
2. Retire `lane-a3-c6-{concerns,copy,controls}` and then `lane-a3-c6-integ`, junction-safe (`cmd /c rmdir` the
   `node_modules` junction first, non-forced `git worktree remove`, `git worktree prune`). Keep the branches.
Final message: ≤ 8 lines.
