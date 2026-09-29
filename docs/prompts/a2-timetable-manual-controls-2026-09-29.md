# A2 — timetable manual controls speak plainly (live drill, Run 347) — train 11

Issued by Lane C, 20:24. Source: `codex-qa/live-drill` and `live-drill2` on live `cd542245`. Runs after or beside
A2 c15/c17; merge origin/main before each slice. Receipts rule applies (`docs/plans/codex-walk-standard.md`).

1. **Readiness numbers must reconcile.** Header "6 Must fix", Publish Readiness "6 Must fix · 10 sessions still to place",
   selected term "2 Must fix", one visible group "No allowed time slot was found · 10 sessions affected" + "Show 7 more".
   One count, one list: every must-fix item is listed in full (no "Show more" for must-fix), each with its fix button,
   and the numbers say which term they cover. (Coordinate with A8 c5, which owns the generation receipt: same source.)
2. **"Unknown section · Unknown subject"** on warning rows: the lookup misses (same id-space class as A2 c15). Every row
   names the real section and subject.
3. **Moving a class when every slot is taken:** a section has a class in every period, so the Timeslot menu lists all
   targets as "(occupied)" and the scheduler is stuck. Offer "Swap with <subject> (<teacher>)" for occupied slots and
   say plainly which swaps are allowed; if no move or swap is possible, say why in one line.
4. **Preview:** show "Checking this change…" at once; then blockers first in plain words ("Mr Cruz already teaches 8-Luna
   at that time"), deduplicated; soft warnings summarised by cause with counts (not 525 rows). Never show
   `SECTION_TIME_CONFLICT` or "Manual candidate entry-1::t1 rejected by shared invariant" on screen.
5. After a committed move/swap/place: a receipt ("Moved TLE for 7-Rizal from Mon 6:00 to Tue 7:30. No new problems.")
   and the Schedule history line in the same words.
Proof: staging, real generated draft, 1366x768: screenshots of each; `ux-audit.js` 0 MAJOR; `test:encoding` green.
Commit and push wip every 30 min.

## Addendum 20:38 — live drill pass 3 (BLOCKERs for the demo)
6. **Swap stalls:** More > Swap sessions, pick TLE (7-Rizal, Mon 6:00) and SCIENCE (same section, Mon 8:15): the dialog stays
   on "Checking options..." with Swap disabled indefinitely. A swap of two classes of the same section must answer within a
   few seconds (or say plainly why not), then save, with Undo and Redo working and Schedule history listing it.
7. **Lock/pin is not reachable** from the normal selected-class actions; make "Lock this class" visible on a selected class,
   show what locked looks like, and that Generate keeps it ("Locked classes kept 1").
8. **Place session** for an unplaced class offered no candidate and no words; say "No free time: every time double-books
   <teacher> or <room>" and offer the nearest swap.
9. Print from Room Schedules ("Print this schedule") did not open a print view within the wait; check it opens promptly.
