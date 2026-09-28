# A6 packet — Teaching Load header to the Header budget (operator 2026-09-29)

Fresh session. Read AGENTS.md §8 (**One look per control**, **Header budget**) and `docs/handoffs/lane-c-to-a2.md`
2026-09-29 00:10. Operator: the Teaching Load header's "compaction to less vertical rows is not graceful nor practical".
Guided mode removal (a2c4c135) is on main and rides train 5 — build on it.
Undo the row-squeeze: two calm rows at 1366x768 — row 1 title/one status chip/primary action/More; row 2 the pickers,
same `@/ui` picker as /timetable. No truncated sentence, no helper text under buttons, no duplicate status lines
(the doubled amber EnrollPro line counts). Tests failing-first; screenshots at 1366x768 and 1920x1080 in docs/reviews/.
One background server, stopped when done. Push to main after QA; post ready-for-release. Do not end the run to wait.
