# Overnight packet c5 — Planner A3 — 2026-09-28 05:05 → 07:00 +08

Issued by Lane C. Rules as in c4 (source-only, no browser, no deploys; A2 ships). Decide, record, keep going.
Use Write/Edit for long appends, never heredocs.

1. **`A3-C4-SUBJECTS-STATS`** — `useSubjectStats.tsx:14-16`: drop the `OWNER_DEPT` marker from "Room constrained", so
   the Subjects page is internally truthful. One executor, one fresh QA, integrate, then post
   `A3 integrated for release at <sha>`.
2. **Retire the c4 worktrees**, junction-safe (`cmd /c rmdir` each `node_modules` junction first, then non-forced
   `git worktree remove`): `lane-a3-c4-{sections,maps,tl,copy,subjects}`, then `lane-a3-c4-integ`. Keep the branches.
3. **Morning brief for the operator**, at the top of your handoff's c4 section, ≤ 25 lines: what A3 changed overnight,
   by route, in plain words; what is live and what waits for A2's next release; the one product decision (08: deselect
   vs unassign, your read B) as a yes/no question; the title-scale decision with the two options; and the list of live
   steps Lane C must run after the release (just the step ids and routes).
4. If steps remain: plain-language sweep of any leftover engineer strings on A3 routes (grep the rendered copy for
   `_`-joined enums, "run #", "session(s)", raw error codes), same stream discipline.

Final message: ≤ 15 lines — done / blocked / not reached, last integrated SHA, handoff path.
