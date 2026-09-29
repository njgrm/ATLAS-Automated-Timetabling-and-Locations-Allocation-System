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
