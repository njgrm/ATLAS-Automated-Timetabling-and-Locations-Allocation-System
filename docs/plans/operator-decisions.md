# Operator decisions — locked (read before every merge, integration or UI change)

A merge that reverts any line here is a failed merge. Resolve conflicts IN FAVOUR of this list, and add or keep a test that
fails if the decision is undone. Only the operator changes this list (Lane C records it).

| # | Date | Decision | Guard |
|---|---|---|---|
| 1 | 29 Sep | **Generate is never greyed out.** Only "a run is in progress" may disable it. Problems are listed with a fix, not used to block. | A8 c5 table-driven test |
| 2 | 29 Sep | **Class Schedule: tabs stay, Expert view is retired, one vocabulary Generate → Draft → Published**, at most 7 controls above the grid; only A7 edits its layout/words. | A7 rendered control-budget test |
| 3 | 29 Sep | **Tooltips are white** with dark text and a soft shadow, app-wide. | A7 c10 |
| 4 | 29 Sep | **Teaching Load header has no Past years button and no Cross-subject / No subject match switches**; other subjects open per teacher ("Show other subjects"); Past years lives in the tools menu. | a5-c8 filter-bar contract asserts absence (63714b1f) |
| 5 | 29 Sep | **Every automated action shows a plain receipt** on the action page and the affected page. | codex-walk-standard receipts rule |
| 6 | 29 Sep | **Presentation outranks function**; UX regressions and wrong values block a train. | walk standard |
| 7 | 29 Sep | **Rollover must never leave a year stuck:** terms are saved from EnrollPro automatically with a receipt; no "confirm term order" step. | A3 (train 12) |
| 8 | 30 Sep 00:40 | **A7's calm Class Schedule proposal (post "A7 -> Lane C, proposal — Step 0", 00:12) is approved as written**, with one change: the unplaced-classes label is **"N classes need a time slot"** (not "need a time"). | A7 c12 rendered control-budget + copy tests |
| 9 | 30 Sep 02:15 | **Teacher Profile and Review load are ONE dialog**: load figures on top (Review load), classes taught below (Profile layout); the row keeps only "Review load". | A3 teacher-one rendered test |
| 10 | 30 Sep 02:15 | **Dialogs open at a normal centered width** (about 42rem), never near full screen; resizing is optional. Temporary-teacher form has no Specialization field. | A3/A5/A9 default-width tests |
| 11 | 30 Sep 02:15 | **No second confirmation after a review dialog**: applying saves at once with a plain receipt and Undo (Apply rooms first). | A9 X4 test |
| 12 | 30 Sep 07:05 | **Until the demo, QA stays and staging is skipped.** Every fix keeps its failing-first test and the QA-agent round and lands on main; a train goes straight to live: A4 builds at the main tip and cuts over live (no staging deploy, no staging walk). Right after cutover Lane C runs the Codex live check; a regression means an immediate rollback to the previous train, then a fix forward. Migrations, generation, publication and live-data writes keep their HIGH gates; a train with a migration still goes through staging. (Replaces the 07:00 wording that skipped QA.) | Lane C, A4, all planners |
| 13 | 30 Sep 08:40 | **The weekly max measures true teaching hours only.** Advisory and ancillary credit never count toward it, so "Above weekly max" flags a teacher only when their section teaching hours exceed the max (server `overCapCount` already did; the Teachers page now matches). | A3, A6, Lane C |
| 14 | 30 Sep 11:10 | **Teaching Load never saves a load the timetable cannot place.** Before "Apply suggested" (or any assignment) saves, Teaching Load runs a quick placement check; a class that cannot fit is named in plain words with a teacher who does fit. The generator also repairs instead of giving up: when a class has no free slot, it tries moving one blocking class (the 30 Sep Makabansa TLE case: only 11:30 was free and every rotation teacher was booked there). | A6, A8 |
| 15 | 30 Sep 11:20 | **Teacher lunch is the lunch window OR the same-length slot right before it** (12:15-13:00 or 11:30-12:15). A teacher free in either has had lunch; only a teacher busy in both is flagged. | A8, Lane C |
