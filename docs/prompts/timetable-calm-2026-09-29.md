# Class Schedule, calm again (operator, 21:36) — A7 c10 (page) + A8 r1 (ATLAS proposes placements)

Operator, on live `cd542245` Run 347 (four screenshots, `scratchpad/codex-qa/1[5-8].png`): "A major regression happened with
the timetable page. Header got so crowded and dense, too overwhelming. Where has the relaxed simple view gone? Why on earth
are the tooltips black? Why is it not just white with a shadowed background? Placing unresolved sessions is just too much,
the warnings are also too much, there should be a toggle for warnings. Our system can't even help schedulers place down the
unassigned sessions? They have to do it themselves? … schedulers should just confirm proposed plans from the system. It's
all just a bunch of walls of text that is dense and crowded. I wouldn't want this system if I was the older-scheduler user."
**This is the top UX priority.** Presentation outranks function. Codex component walk: `codex-qa/tt-walk-a`, `tt-walk-b`
(Lane C adds its findings below as they land).

## What Lane C sees in the screenshots (1366-1600 wide)
- Header: 3 rows, ~20 controls before the grid: tabs Schedule/Planning/Setup/Policies/Runs; a pill cut off at both ends
  ("olved — this schedule cannot be pu"); Publish schedule; "Place 10 unresolved sessions"; Undo; Redo; History 2; More;
  "Rooms changed since this ..."; See what changed; Update schedule; Term; Show; Schedule for; Edit draft; Discard draft;
  a State line; a black tooltip over the Edit button.
- Grid: nearly every card carries an amber "1 warning / 2 warnings / 3 warnings / 4 warnings" chip; names cut off
  ("SPECIALIZATI...", "S...", "DE...", "C. AGUILAR · Ro..."); raw codes (DEVL_READING, G7AW, SPA).
- Tooltips: black (bg-slate-900) — `ui/tooltip.tsx:69`, 277 call sites. It was made dark to fix an earlier "blank white
  pill"; fix that cause properly instead.
- Place unresolved panel: jargon and contradictions ("Fixing publish blockers → No available slot", "ATLAS cannot test
  slots until this is resolved", "10 sessions left to place" vs "NEXT ACTION Place 4 sessions", "Check slot", "Skip").
- Publish Readiness: "Whole year: 0 Must fix · 10 sessions still to place", "Detail for the selected term only: 147 shown ·
  0 Must fix", then three identical rows "GR7 - Aguinaldo · TLE / CRUZ, PAOLO BENJAMIN · Adviser Rizal" + "Show 7 more".

## A7 c10 — the calm page (client; A2 mc is fixing swap/lock logic in the same files: merge origin/main before each slice)
1. **One calm header, one row + status line.** Visible: page title; Term; View (Section / Teacher / Room) + the pick;
   ONE primary action for the current state (Generate / Review 10 unplaced / Publish); and "More" holding everything else
   (Undo/Redo/History, Update schedule, See what changed, Edit draft, Discard draft, exports, print, expert tabs Planning,
   Setup, Policies, Runs). Undo appears as a small button only right after an edit. A status line in plain words:
   "Draft · not visible to teachers yet · 910 of 920 classes placed · 10 need a time". Nothing cut off, ever.
2. **The simple view is the default for every user**; Expert (the tabs and dense tools) is one clear switch in More, and
   the choice is remembered per user. If the simple view was removed or overridden since `3216d383`, restore it.
3. **Warnings off by default.** A toggle "Show warnings (696)" in the header area. Off: cards show no warning chips; only
   must-fix problems show (red). On: warnings appear, grouped. A card never shows more than one small icon.
4. **Cards readable:** subject NAME (full, wraps to two lines, never "…"), teacher, room; no section codes on a section's own
   view; to-be-hired shown as "To be hired". Colour by subject family, calm tones.
5. **Tooltips app-wide: white, dark text, soft shadow, thin border**, at least 14px, max ~22rem, wraps. One primitive change;
   check 10 call sites render their text (no empty pills).
6. **Publish readiness** in three plain parts: what blocks publishing (count, one line per cause, one button each), what is
   only advice (collapsed, grouped by cause with counts), what is fine. No "Whole year / selected term" split unless they
   differ, then say it in words. No duplicate rows: group "GR7 - Aguinaldo · TLE × 4".
7. **Unplaced classes panel** = A8 r1's proposals (below): a short list "10 classes need a time", each with ATLAS's proposed
   fix and Accept / Other options. No "Fixing publish blockers →", no "NEXT ACTION", no "Check slot / Skip / Find".
Proof: 1366x768 screenshots before/after of the header, a section week with warnings off and on, a tooltip, the readiness
dialog, the unplaced panel; count visible controls above the grid (target 7 or fewer); `ux-audit.js` 0 MAJOR;
`test:encoding` green. Ship in QA-passed slices (tooltips, header, warnings, cards, readiness, unplaced panel).

## A8 r1 — ATLAS proposes where unplaced classes go; the scheduler confirms (server + API; HIGH: generation/manual edit)
For each unplaced class (NO_AVAILABLE_SLOT), search for a repair the validator accepts: (a) a free slot with a different
allowed room; (b) a one-swap move (move class X out of slot S to a free slot, place the unplaced class in S); (c) a two-step
chain. Rank by fewest changes and fewest new warnings. Return per class: the proposal in plain words ("Move Science for
7-Rizal from Tue 8:15 to Thu 2:30, then put TLE for 7-Aguinaldo on Tue 8:15 — no clashes"), the changes it makes, and a
dry-run proof (0 new hard conflicts). Endpoints: list proposals for a draft; apply one (writes through the normal manual
edit path, so Undo/History work); "Apply all safe proposals" (one receipt: "Placed 9 of 10. 1 still needs a time: …,
because …"). If no proposal exists, say why in one line (e.g. "Mr Cruz is booked every period Mon-Fri"). Unit tests on
fixtures; prove on a staging copy of live Run 347: how many of the 10 get a proposal, 0 new hard conflicts after Apply all.
Commit and push wip every 30 min.

## Addendum (Lane C code search) — the simple view did not disappear; it grew
- Mode: localStorage `atlas_timetable_layout_mode`, default 'simple' (`ScheduleReviewWorkspace.tsx:94,132`). The dense header
  the operator saw IS the simple header (`TimetableSimpleHeader.tsx:189`), grown by A2 c14 (`318000998`, `e411c4e22`,
  `95534cedb`), A8 c3 (`d87e1b3ed`) and the export centre (`a9a700ba6`). The expert tabs row is `TimetableSubNav.tsx:24-62`
  and shows in simple mode; "Rooms changed since…" + See what changed + Update schedule is `SimpleChangeNotice.tsx:112`.
  So: shrink the simple header back (row 1), keep TimetableSubNav for Expert only, turn SimpleChangeNotice into one short
  status-line sentence with one button.
- A warnings filter already exists (`severityFilter` 'all' | 'hard' | 'soft' | …, `SimpleHeaderHelpers.tsx:396`,
  chip `TimetableGridConflictBadge.tsx:114-169`): make the default 'hard' (must-fix only) and present it as the plain toggle
  "Show warnings (N)", remembered per user.
- Tooltips: 64 of 274 call sites pass their own className; after the primitive turns white, sweep those 64 so none re-darken.

## CORRECTION (operator, 21:50) — supersedes rows 1-2 above
"Those tabs should not be moved to expert view, since expert view should be retired anyway, we should never use those. It
was fine there in previous releases when the whole header wasn't filled. Just propose simplified fixes for each page. The
draft should never be 'planning', it should be 'draft'; even our terms aren't consistent anymore. 'Build a new draft'
generates a schedule? … We really need to place all our focus on this page … there is no system without the timetable."
1. **Tabs stay** where they are (Schedule, Setup, Policies, Runs, and the draft tab). **Expert view is retired**: remove the
   switch and never route a scheduler to it; the page is one mode.
2. **Baseline = the relaxed header** of `3e894d0e` (2026-09-26 00:26, "relaxed Simple header"). Since then about 20 commits
   from A2, A3, A8 and the export centre each added a control or a sentence to it. Start from that composition, keep only
   what the scheduler needs first, move the rest into More.
3. **One vocabulary**, the same on every button, dialog, status line, tab, history row and export: *Generate* (the action)
   makes a *Draft* (the result); a draft is *Published*. Rename the "Planning" tab to "Draft"; the Generate button and its
   dialog use the same words ("Generate a draft" → "Draft ready"), never "Build a new draft" or "schedule" for the same thing.
   Grep and list every label that names these three ideas, before/after, in the handoff.
4. **Step 0 is a proposal, not code** (except tooltips, which are approved): for each tab (Schedule, Draft, Setup,
   Policies, Runs) and each panel (unplaced, publish readiness, change notice, More menu), one screenshot of today at
   1366x768 and one plain proposal (what stays, what moves to More, what is deleted, the new words). Post it in
   lane-c-to-a2.md; Lane C reviews it with the operator before the header code starts.
5. **One owner.** Until the operator signs the page off, only A7 edits the Class Schedule header, tabs and panels'
   layout and words. A2 mc changes behaviour (swap, lock, place) only and adds no control or sentence to the header.
   Add a rendered test that counts controls above the grid (budget 7) and fails on any new one.
