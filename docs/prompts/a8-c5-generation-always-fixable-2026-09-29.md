# A8 c5 — the timetable is always reachable: every remaining blocker has a plain fix-it action

Issued by Lane C, 16:40. Start after A8 c4 lands. Risk HIGH (generation gate text/links only; no gate relaxation beyond
A8 c3). Target: morning train before the demo. Real staging data.

## Operator (16:35)
"After train 10, can we expect that timetable will always be available and/or fixable? We can't have this happening."

## Rule (binding)
After A8 c3, generation proceeds with teacher gaps and workload/qualification advisories. Whatever still blocks
(no term, no time windows, no rooms, sections not synced, anything else) must never be a dead end:
1. **One line per root cause**, in plain words, with a count and ONE button that goes to the exact page/state that fixes
   it (e.g. "3 sections have no home room — Give them rooms ›" -> /sections with the guided step open). No codes, no
   per-row repetition, no generic "Recheck" per line (one "Check again" for the whole panel).
2. Inventory every hard blocker code the preflight can emit; for each, name its fix page and write the sentence. A code
   with no fix page is a defect: add the smallest fix path or make it advisory with a written reason.
3. Test: a table-driven test asserting every hard blocker code maps to a sentence and a route; a fixture per code.
4. Publication: when the run has placeholder-owned or open classes, the refusal names them the same way ("12 classes have
   no real teacher — Cover them ›").
5. Proof on staging: force each of the top 4 blockers (e.g. remove a time window on a scratch year), screenshot the
   panel, follow the button, fix, generate.
