# Packet c6 — Planner A3 (non-timetable UI/UX) — 2026-09-28 06:15 +08 onward

Issued by Lane C. Rules as in c4/c5 (source-only, no browser, no deploys; A2 ships; post
`A3 integrated for release at <sha>`; Write/Edit for long appends, never heredocs). No deadline: work the queue,
then hand off. Keep your c5 standard: refuse any sentence an operator cannot act on.

## Goal: every non-timetable route an operator can reach is graded and demo-clean

Routes not yet graded by A3 (from the router): `/login`, `/`, `faculty`, `faculty/concerns` (**inventory row 40: it
renders the class grid under "Teacher Concerns"; A2 confirmed it is yours**), `faculty/preferences`,
`faculty/room-preferences`, `teachers`, `teaching-load/history`, `subjects/decision-workspace`,
`subjects/requirements`, `admin/year-setup`, `policies`, `audit`, `setup`, `exports`, `my`, `timetabling/how-it-works`,
and the `*` not-found page. Skip `room-schedules` (unfinished, to be redesigned; operator ruling) and every
`/timetable/*` or `/public/*` route (A2's).

1. **Source audit table** in your handoff: per route, the words in the main panel, raw/engineer strings (quote them),
   any status without a visual cue, dead or duplicate controls, "coming soon"/placeholder text, and whether it is
   reachable from the sidebar. Rank by demo exposure (what an operator will click on Wednesday).
2. **Fix row 40 first** (a concerns list, or an honest empty state, never the class grid).
3. Fix the ranked findings in consolidated streams (one executor each, one fresh QA), biggest demo exposure first:
   plain words, one verb per action, a visual cue beside every status, less is more, SMART-family calm styling
   consistent with the routes you already fixed.
4. The `DUPLICATE` copy at `subject.router.ts:182` if it is client-rendered wording you own; otherwise leave it.
5. Live-acceptance steps for every change, listed for Lane C. Handoff c6 section with a 10-line morning summary on top;
   `live-state.md` Lane A3; worktrees retired junction-safe; everything pushed.

Final message: ≤ 15 lines — done / blocked / not reached, last integrated SHA, handoff path.
