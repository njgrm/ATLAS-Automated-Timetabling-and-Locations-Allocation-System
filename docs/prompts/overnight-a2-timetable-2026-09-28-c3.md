# Packet c3 — Planner A2 (timetable + releases) — 2026-09-28 05:55 +08 onward

Issued by Lane C (overnight manager). Authority as in c1/c2, with two clarifications from Lane C, who holds the
operator's delegation tonight:
- **06:30 was a handoff target, not a stop.** The operator said to keep chaining until they say stop. There is no deadline
  on this packet; work until the queue is done, then hand off.
- **The generation/publication grant is NOT struck.** The operator authorised drafts AND publish in chat (2026-09-27).
  Your c2 narrowing is overruled; use the grant only when an acceptance row needs it, with the usual gates.

## Queue, in order

1. **Ship the staged release `a1db27d5`** (contains your c2 batch and A3's c4 `ed14720c`), following your c2 handoff's
   morning list: one bounded review of the re-pin + 3 amended clauses; create and build `lane-a2-release-a1db27d5`;
   dry run; cutover; D1–D8; post-action QA; B9–B22 on https://njgrm.buru-degree.ts.net. If A3 has posted a newer
   `A3 integrated for release at <sha>` before your review starts, you may re-pin to include it (one more bounded
   review); otherwise do not chase it.
2. **Live acceptance for A3's c4 rows** (steps in `planner-a3-non-timetable-ui-ux-handoff.md`, c4 section) on the
   new release, in your browser profile.
3. **From A3 (handed over):** #52 (stale grid on first render of `/timetable/map`: `TimetableRouteViewSync.tsx:67`,
   `CenterWorkspace.tsx:585-614`, `timetable-route-loading-intent.ts:7`) and the #53 occupancy prop
   (`CenterWorkspace.tsx:608` must pass a real `buildingOccupancy`; the campus map tiles still read "0% FILLED" live,
   Lane C findings `docs/reviews/lane-c-overnight-20260928/findings.md`).
4. **The timetable demo walkthrough (P0 for Wednesday):** generate → review → fix a conflict → swap/move → undo →
   publish → public view → exports, walked live and graded for older users (fewer words, one verb per action, a visual
   cue beside every status), with every stumble fixed or listed. Also: the residual "Locked classes kept" unmeasured 0,
   and the `tt-output-c03r` workbook columns dropped in production data (take ownership if it is timetable export).
5. A release for items 3–4 once integrated, with the same gates and live acceptance.
6. Handoff c3 section, acks, live-state. Everything pushed. Record the relative-path `[System.IO.File]` lesson as a
   proposed AGENTS.md rule in your handoff (the operator reviews directive changes).

Final message: ≤ 15 lines — done / blocked / not reached, live release SHA, handoff path.
