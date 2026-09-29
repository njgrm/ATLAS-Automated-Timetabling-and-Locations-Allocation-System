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

## Addendum 17:25 — do the A8 section of docs/prompts/truth-fixes-2026-09-29.md FIRST (two BLOCKERs), then this packet.

## Addendum 19:05 (A4 train 10 gate) — one hardening row
`atlas-client/src/lib/timetable-generation-readiness.ts:302` reads `diagnostic.groups.length` unguarded; treat a missing
`groups` like an empty one (the legacy one-line fallback its comment promises). Runtime is safe today (the parser at :483
always sets it), so this is a test-fixture gap; re-pin `a2-header-budget-2026-09-29.test.tsx` H4 A/B on purpose.

## Addendum 20:05 (operator) — Generate is never greyed out
Operator: "it should never be disabled." After train 10 the button can still be disabled by `timetable-capabilities.ts:161-210`:
`curriculumState === 'blocked'` ("Setup inputs for the active school year are not ready yet"), `!generateAllowed ||
!zeroWrite` ("Generation readiness is not verified"), `driftBlocked`, `unavailable/failed`. Change the contract:
1. The Generate button is always enabled (except the seconds while a run is in progress, which shows progress).
2. Clicking it always opens the Generate dialog. If generation can run (teacher gaps, advisories), it runs and the result
   lists what was left open, in words. If something truly prevents any timetable (no sections, no time periods, no
   subjects, school year out of sync), the dialog says so in one plain line per cause with a count, one fix button each
   that opens the exact place, and "Check again" — never a greyed button with a tooltip.
3. Anything that is only a warning must not stop generation; list the true stoppers in the handoff and why each cannot
   be generated around (Lane C reviews that list).
4. A check that could not run (`unavailable/failed`) retries by itself once, then says so plainly with a Retry button.
Table-driven test over every capability input: no state returns a disabled Generate except "run in progress".

## Addendum 19:58 — the generation receipt (live drill, Run 347)
Live result after Generate: "6 Must fix, 696 advisories — this schedule cannot be published yet." and the progress dialog
only says "Checking placements and scheduling rules." That is not a receipt. After every run, one plain summary:
"Placed 1,316 of 1,320 classes. 4 could not get a time: [open list]. 72 classes are on to-be-hired teachers. 6 things must
be fixed before publishing: [each in one line with its fix button]." Group the 696 advisories into a few lines by cause
with counts (e.g. "412 classes are in a room a little small for the section"), never a raw count alone. Also: the
Generate dialog shows "Term setup Not confirmed" while School Year Setup says "TERM 1, verified live from EnrollPro";
say the same thing in both places. Keep the run's elapsed time in the receipt.
