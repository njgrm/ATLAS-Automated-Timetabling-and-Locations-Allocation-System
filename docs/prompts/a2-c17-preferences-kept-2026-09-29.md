# A2 c17 — show whether teacher preferences were kept (train 12, cut 00:30)

Issued by Lane C, 19:05. Context: `docs/plans/timetable-demo-drill-2026-09-29.md`. Generation honours REVIEWED teacher
availability (UNAVAILABLE = hard exclusion, `schedule-constructor.ts:1831-1856, 2072-2080`; PREFERRED = soft ranking,
`:1858-1863, 2229-2231`), but no screen tells the scheduler whether it did. For the demo, the scheduler must see it.

1. After a generation run (and on the draft/published timetable), one plain line in the run summary:
   "Teacher preferences: 2 of 2 unavailable times kept · 5 of 7 preferred times met" (computed from the reviewed
   availability for that year/term against the placed entries; server-side, one pure function, unit-tested).
2. The line opens a short list per teacher: name, "Unavailable Friday afternoon — kept", "Prefers mornings — 3 of 5".
3. If a teacher has preferences that are only DRAFT/SUBMITTED (not reviewed), say so in words: "2 teachers' preferences
   are not reviewed yet, so they were not used" with a button to Teacher Preferences.
4. No preferences at all: say nothing (no empty box).
Proof: staging, real data, 1366x768: enter + review preferences for 2-3 teachers, generate, screenshots of the line and
the list; a test where an UNAVAILABLE slot is violated in a fixture shows "1 of 2 kept". `ux-audit.js` 0 MAJOR,
`test:encoding` green. Commit and push wip every 30 min. Land by 00:15 or it misses the final train.
