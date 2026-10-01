TIER: T3 (generation)   OWNER: Timetable   BASE: a68c21b3 (rebase on p04a once integrated)   WORKTREE: E:\ATLAS-worktrees\lane-timetable-p04b   BRANCH: work/lane-timetable-p04b
ACCEPTANCE (operator's words, verbatim; do not restate): "considerations of well being, stuff like pregnancy, injury, or ailments that would place these teachers teaching area in the ground floor only to avoid having to go up and down the stairs."
CONTEXT: avoidUpperFloors is stored per teacher but NOTHING in generation reads it (only preference.service.ts).
  Room has floor / floorNumber (prisma/schema.prisma ~181); confirm which one means ground floor from data and say so with
  evidence. Decision 1: Generate is never greyed out; problems are listed with a fix. Decision 14: repair, don't give up.
DELIVERABLE: the generator places every class of a teacher with avoidUpperFloors=true in a ground-floor room only (hard
  rule). If no ground-floor room is free, it tries swapping one other class off the ground floor first; if still
  impossible it leaves the class unplaced and names it in plain words ("Ms X needs a ground-floor room; none is free at
  Mon 9:00 - free one or move the class"). Manual moves in the draft that put such a teacher upstairs show the same
  warning. Room schedules and printouts never show the reason.
OWNED FILES: generator / constraint-validator and their tests, the draft warning text module. Nothing in Setup pages.
FORBIDDEN: migrations, generation or publication on live, Setup files, merging before the operator sees it (T3).
DONE MEANS: failing test first (fixture: 1 marked teacher, rooms on floors 1 and 2) -> fix -> generator suites + full
  server suite + typecheck vs baseline -> independent HIGH review -> report. Show the operator before merge.
REPORT BLOCK: as PLANNERS.md.
