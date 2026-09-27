# Overnight packet c2 — Planner A3 (non-timetable UI/UX) — 2026-09-28 00:45 → 06:30 +08

Issued by Lane C (overnight manager). The Authority, Coordination and final-message rules of
`docs/prompts/overnight-a3-ui-ux-2026-09-28-c1.md` apply unchanged (no deploys; A2 ships; post
`A3 integrated for release at <sha>` in `docs/handoffs/lane-a-to-c.md`; never junction + `git worktree remove`).
The operator is asleep: decide, record, keep going.

## Browser custody tonight — scheduled, not contended

**A3 holds the browser from now until 02:45 +08.** Write `E:/ATLAS-worktrees/.browser-lock` as
`A3 <ISO time> scheduled window until 02:45`. A2 is told not to take it before 02:45. Use the window for the browser
items first; do source work only while a browser step is running elsewhere. Release the lock at 02:45 even if
unfinished, and record what remains.

## Facts from c1 (verified by Lane C at 00:40)

- Live is **`d31bfacb`** and it contains `1e417694` (#53). It does **not** contain `c5cffa72` (page titles) or
  `dd5b2366` (S-e palette ratchet). A2 re-pins its ~04:30 release to the `origin/main` tip, so integrate by **04:15**.
- Your c1 handoff section and the `live-state.md` Lane A3 section were not written (a heredoc truncated). Use the
  Write/Edit tool, never a heredoc, for long appends.

## Queue, in order

1. **Browser window (until 02:45), in this order:** **B5** (`/sections` swap Cancel = zero change); **#52** (Building
   view first render keeps the previous section's grid; precondition: "Open map" before canvases render); the **nine
   owed `1e417694` steps** (#53 live: real utilisation or an honest hidden state, never "0%"); then walk **your demo
   script twice** (Dashboard → Sections → Subjects → Teachers/Teaching Load → Exports/Setup), graded for older,
   mouse-first users (words, one verb per action, a visual cue beside every status, clicks to finish). Every stumble
   becomes a fix or a listed item.
2. **Fix what the walks found**, in consolidated streams, one executor each and one fresh QA. Biggest demo value first.
3. **S-e sweep:** the palette ratchet is in; run the per-file worklist from its failure output and bring the raw
   neutral count down on the demo routes first.
4. The remaining **UX-R02–R05 / UX-R03c** items from your graded route table.
5. Deliverables before 06:30: the handoff sections for c1 and c2 (ledger rows terminal or blocked, SHAs, QA tallies,
   evidence paths, and rows for live acceptance on A2's release with exact steps); the `live-state.md` Lane A3 section;
   retire your four c1 worktrees (`cmd /c rmdir` any `node_modules` junction first) and your c2 ones; clear the lock.
   Everything pushed.

Final message: ≤ 15 lines — done / blocked / not reached, last integrated SHA, handoff path.
