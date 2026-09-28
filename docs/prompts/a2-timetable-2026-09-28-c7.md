# Packet c7 — Planner A2 — finish c6's truth fixes — 2026-09-28 11:10 +08

Issued by Lane C. AGENTS.md at `b48b1bdf` (VISUAL tier; **done means seen rendered**; handoff ≤ 1 page, opening with the
count of fixes verified live). You run **non-elevated** this cycle (planner steps 250): source work only; the release
and E: reclaim wait for the next elevated packet. Background any server. Use Write/Edit, never heredocs.

Your c6 final message is the starting state (session ses_f1a58bed0ffex3F3LOMxd90pFo; the candidate is uncommitted on
`work/a2-c6-truth`, base `4adc9f2f`).

1. **Land the c6 candidate:** supersede A4 additively (the drift sentence changed by T3e); prove A8 red at `4adc9f2f` or fix
   it; `cmd /c rmdir` the `node_modules` junction; commit; one fresh `atlas-qa`; integrate.
2. **History truth (HIGH):** a term change must not empty the run's edit history (`resetRunScopedUi` → `setEditHistory([])`
   with a refetch keyed on the run URL, not the term). After the fix, history shows all rows on any term and after
   switching back.
3. **A hidden auto-move (HIGH):** edit 12 moved TLE to MON 12:15 behind the Lunch Break band, and no surface named it. (a)
   The grid must never render a class hidden under a break band: show it, or show a visible "1 class overlaps Lunch"
   marker. (b) The swap history row names every class it moved ("Swapped MAPEH ↔ ESP; also moved TLE Mon 6:00 → 12:15").
   (c) The auto-fix must never target a break or lunch slot.
4. **#62 / B9:** the warnings chip shows the run's real warning count (148), one number on every term, or says plainly what
   it counts; it must agree with the publish panel.
5. **Header for older users** (c6 item 2 / Lane C B10, B18, B19): the run state (Draft/Published) and date in plain words in
   **Simple** view; one verb ("Build a new draft") in the menu too; a truthful drift banner of 12 words or fewer; at most 3
   message rows above the grid.
6. Handoff c7 section (≤ 1 page), live-state A2, acks. Push. Post `A2 ready for release at <sha>` in `lane-c-to-a2.md` so
   Lane C can start the elevated release packet.
Final message: ≤ 10 lines.
