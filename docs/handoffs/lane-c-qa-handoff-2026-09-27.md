# Lane C QA session handoff — 2026-09-27 (~01:45 +08)

Supersedes the queue in `lane-c-qa-handoff-2026-09-26.md` (role, channels and operator rulings there still hold).

## Live state (as of 2026-09-27 01:45 +08)

- Release **`0da104f9`**. `c50b15ff` (Change room fix) and `e51388c1` (swap auto-fix bound + shape-aware undo) are on
  `main`, **not deployed**; check `docs/plans/live-state.md` → Live release.
- **Run 320 published** 00:38 +08 (revision 46, marker effective 2026-09-26 UTC). No unpublished draft exists.
- Run 320 history: 3 rows (two "Swapped two sessions", one "Undid an earlier change" 12:22 AM).
- The Chrome profile's `/timetable` is left in the **Simple** layout.

## Done this session (all posted to `lane-c-to-a2.md`, findings #38–#51)

1. Revert leg on run 320: "Edit reverted." with no change; undo logged as a revertable row "warnings: 0" (#38–#42).
2. Grades: generate dialog dense + "1295 unassigned" vs checklist "0 to place" (#43–#44); publish confirm clear (#45).
3. Published run 320: 09-27/09-28 resolve; 09-26/09-25/09-20 → `PUBLISHED_REVISION_INVALID`, no fallback; UTC
   effective date (#46–#47). A3: header and API agree, but masked (published in the active term) (#48).
4. Inventory chunk 1 (rows 15/221, 22, 35–46): 37, 40, 46 differ; 22 unperformed; #49 Advanced rules strands users in
   Expert; #50 More menu hides two-thirds of itself; #51 Expert calls a published run "Draft".

## Queue

1. **On the release carrying `c50b15ff` + `e51388c1`:** Change room on MAPEH (subject with `requiredFeatures: []`);
   #28 no-click after an auto-fixed swap; re-run the swap → history → revert repeat against A2's new contract (preview
   names the move or there is none; revert restores or refuses).
2. **DONE (session 2, #52–#55, posted to A2).** ~~Chunk 2, runnable now~~ (not touched by the pending release): Building view "0%" (open Campus map, pick a building),
   185 (`Run #<id> - <status>` on `/room-schedules`), 56/57 (accessible name vs visible severity).
3. **Chunk 2, after the release** (undo and ManualEditPanel change with it): 249/260/266, 219/222, 140/141.
4. Optional, if A2 wants it: A3 discriminating read (publish, change active term, read `source.termIndex`).
5. Row 22 needs an unpublished run that needs a step (generate a new draft first).

## Runner notes (new)

- Tell runners the Simple **More menu scrolls** (510 px box, 1464 px content) and name the group to scroll to.
- Never send a runner through "Advanced rules" or "Expert view" without telling it the way back: the "Simple view"
  button top right (may need two clicks). The layout is saved in the browser.
- The public API `GET /api/v1/schools/1/schedules/published?date=…` answers without sign-in; runners read it in a tab.

## Cost (`subagent_tokens`)

Previous session: 109,335 + 127,889 + 105,057 + 134,109 + 68,720. This session: revert 162,106; route search 57,896;
grading 111,900; publish + public reads 127,993; chunk 1 114,325 + 98,748 + 151,529 (two runs lost to #49/#50).
Accepted outputs this session: 4 of 5 queue items, 14 findings. Per-item cost ≈ 206k.

## Session 2 (2026-09-27, after 01:45 +08)

- Live still `0da104f9`; `c50b15ff`/`e51388c1` not deployed (Live release block checked). Queue item 1 still waits.
- Done: chunk 2 release-independent rows (Building view 43/164/165/246–249, 185, 56/57) → findings #52–#55, posted.
- New for the next session: #53 asks A2 for an API read of one G7 room's utilisation before wiring props; if A2 wants
  Lane C to do it, use UI evidence (the map endpoint may need the bearer token).
- `subagent_tokens`: 99,454 (building) + 74,753 (185) + 77,215 (56/57) = 251,422 for one queue item, 4 findings
  (≈ 63k per finding; ≈ 84k per flow — about half the previous session's per-run cost, with one flow per run and exact steps).

## Session 3 (2026-09-27)

- Live still `0da104f9` (Live release block checked); queue items 1 and 3 still wait on the release. No A2 ack on #53.
- Done: queue item 5. **Draft run #321 generated** (not published); row 22 differs, plus findings #56–#59, posted.
  On a published run the generate path is More › Schedule actions › "New version"; "Generate" appears only on a draft.
- Next: the release carrying `c50b15ff` + `e51388c1`; run the legs on draft 321. Item 4 (A3) only if A2 asks.
- `subagent_tokens`: 90,686 + 122,630 = 213,316 for one queue item, 4 findings + 1 row (≈ 53k per finding).
