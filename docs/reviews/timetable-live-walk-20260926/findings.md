# Live timetable walk — older-scheduler review (2026-09-26)

**Release walked:** `26f7c907` (served chunk `assets/index-BgXhGnEV.js` confirmed). **Scope:** school 1,
SY 2031-2032, Term 2, draft run 318, Section view `GR7 - Luna`. **Method:** read-only `atlas-browser-qa` on
Claude in Chrome, operator-signed-in session; requested 1366×768 but the window rendered at **1536×730** (it cannot be resized — see `docs/reviews/system-walk-20260926/01-year-setup.md`). Tally **11 observed / 2 blocked / 0 unperformed**;
R12–R13 (390×844) BLOCKED: `resize_window` left the viewport at 1536×730, so no phone claim is made. Nothing
was generated, placed, published or saved. **Perspective:** a veteran scheduler who has built timetables on
paper and in spreadsheets, and who will judge the tool on whether it tells the truth and saves time.

## Verdict

The screen is calmer and more honest than it was yesterday. The header is down to six labelled
controls, the session dialog answers "when is this?" correctly, and every warning says whether it blocks
publishing. But the **single largest problem on the schedule, 100 of 194 warnings, has no name**: the
Review-issues list prints the engine code `FACULTY_LUNCH_WINDOW_VIOLATION`, and the readiness sheet calls
the same group "A problem that this version of ATLAS does not have a name for yet." Last night's plain-language
work fixed the wording system but missed the rule that fires most. A scheduler would read that as "the tool
doesn't know what it's complaining about" and stop trusting the other 94.

## What an experienced scheduler would say (by severity)

| # | Finding | Evidence (live) | Severity |
|---|---|---|---|
| 1 | **The most common warning is unnamed.** 100/194 warnings show as the raw code `FACULTY_LUNCH_WINDOW_VIOLATION` in Review issues, and as "A problem that this version of ATLAS does not have a name for yet." in Publish Readiness. The client has **no mapping** for this server code (`grep` of `atlas-client/src` outside tests: 0 hits; server emits it from `constraint-validator.ts` and `scheduling-policy.service.ts`). Two surfaces, two texts, neither usable. | R3, R4 | **BLOCKING** for trust |
| 2 | **"Must fix" is still not the one word.** Review issues shows `All(194) Hard(0) Soft(194)`, a `SOFT` tag and "Start with hard blockers"; Publish Readiness says "0 Must fix". C3 J1 claimed one word per idea — the Review-issues panel was not converted. | R3, R4 | HIGH |
| 3 | **Teacher lunch and 180-minute blocks are "warnings" that never block.** 100 lunch-window violations and 17 long teaching blocks ("teaches 180 consecutive…") are labelled "Does not block saving or publishing", and the readiness banner says "Ready except for warnings". A scheduler knows a teacher without a lunch break is a grievance, not a note. Whether these are soft is a policy decision for the operator; the screen should at least lead with them instead of burying them in 194. | R3, R4, R5 | HIGH (policy) |
| 4 | **194 warnings with no priority.** The count is shown as one number; groups are listed, not ranked by consequence, and there is no "fix these 3 things first". For a veteran, 194 is noise until the tool says which ones matter. | R1, R3 | MEDIUM |
| 5 | **No draft/published status in view.** Nothing near the header says whether this grid is the draft or what teachers currently see; the only hint is that the primary button reads "Publish schedule". A scheduler must never have to infer which version they are editing. | R1 | MEDIUM |
| 6 | **No Undo in the everyday layout.** Simple has no Undo/Redo; "Schedule history" is three levels deep under More ▸ Expert tools and is a log, not an undo. Anyone who has dragged the wrong class wants Ctrl-Z, not a history page. (Audit finding 10, still open.) | R8 | MEDIUM |
| 7 | **Room view has no empty-state and an odd label.** First room `G10 Room 101 · G1AW` shows 2 sessions in the week and nothing saying the room is mostly free; the `G1AW` suffix is unexplained. | R9 | LOW |
| 8 | **Phone layout unverified.** Two attempts could not produce a 390 px viewport in Chrome; the audit's `min-w-160` horizontal-pan question remains open. | R12–R13 | OPEN |

## What is genuinely better (keep it)

- **Header:** six controls, one primary — Term · Show · Schedule for · `194 warnings` · `Publish schedule` · More;
  Show and Schedule for have **visible labels** again. Grid visible in ~3 s, 0 console errors.
- **Session details:** centred dialog at desktop width, TIME card `Monday · 07:30–08:15`, the warning in a
  full sentence naming the teacher and the limit, and one action row (Move time, Change room, Swap, Change
  owner, Expert details, Close). This is what yesterday's operator report asked for.
- **Consequence wording:** every warning ends "(Does not block saving or publishing.)"; the readiness sheet
  states the whole-year vs selected-term split plainly ("Whole year: 0 Must fix · 0 sessions still to place",
  "Detail for the selected term only: 194 shown · 0 Must fix"). One scrollbar, Close reachable.
- **Counts agree:** the six Review-issues groups sum to the header's 194.
- **Unassigned access:** More ▸ Daily tasks ▸ "Unassigned sessions (0)" with "No unassigned sessions in Term 2."
  — present and explained at zero, not hidden.
- **Honest emptiness:** Schedule history says "Nothing to show yet: no class has been moved, swapped or given a
  new room in this schedule."

## Not exercised

The repair banner (no repair state on run 318: R11 NONE), the unassigned drawer (0 items), the generation-blocked
path (the year is generatable), and phone widths. None of the overnight C1/C2 fixes for those paths has been seen
in a browser on live.

## Recommended next cycle (client-only, MEDIUM)

1. Add `FACULTY_LUNCH_WINDOW_VIOLATION` to the canonical violation label map ("Teacher has no lunch break
   in the allowed window") and add a guard test that **every code the server's validator can emit** has a
   client label, so the next new rule cannot ship unnamed. This is the class, not the instance.
2. Convert the Review-issues panel's `Hard/Soft/SOFT/hard blockers` wording to the C3 vocabulary.
3. Show the draft/published state beside the run in the header status slot.

Operator decisions (not planner calls): whether lunch-window and 180-minute-block violations stay soft; whether
Undo/Redo belongs in Simple.

## Cost (`subagent_tokens`)

Walk 1: 68,237 (BLOCKED `NEEDS_SESSION`, no sign-in in the Chrome profile). Walk 2: 132,100 (43 tool calls).

## Re-check on `e4989b72` — independent second opinion (Codex CLI, 2026-09-26 evening)

Read-only, signed in, 1536 px, 35 browser calls. One console error only: the EnrollPro `settings/public` 502.
The live release had moved from `26f7c907` → `400a6909` (15:49) → `e4989b72` (17:24, A2).

**Fixed since the morning walk**
- **#1 fixed:** the 100-warning group now reads **"Teacher has no free lunch window"**.
- **#2 fixed in the Review-issues panel:** "0 Must fix + 194 Warning". No Hard/Soft wording.
- Group sums still reconcile (17+100+31+3+10+33 = 194), and Publish Readiness agrees on the numbers.

**Still open, confirmed by both runners**
- **#5 no draft/published statement.** Only a "Draft" tab and the Publish button hint at it. A drift banner now also shows ("Schedule information changed… current schedule stays unchanged…"), which makes the page's state harder to read.
- **#6 no Undo/Redo** anywhere on the screen.
- **#7 Room view label** "G10 Room 101 · G1AW": a mostly empty week with no empty state.
- **#4 "194 warnings" / "Ready except for warnings"** gives no priority to act on.

**New**
- **One warning, two names.** Review issues and Publish Readiness use different labels for the same groups: "Long teaching block" vs "Too many consecutive periods", "Long idle gap" vs "Long teacher idle gap", "Too many building changes" vs "Too many building transitions". "Cross-Floor Transition" is still title-case engine wording. A second label map survives. The label guard in `9b1ec14a` checks that each code *has* a label, not that there is only *one* label per code. → **A2**, MEDIUM.
- **The More menu has grown to six groups:** Schedule actions, Daily tasks, Expert tools, Help & display, Tools (Teacher concerns, Campus map, Manual edit, Building view) and Schedule data (Latest Run, Refresh timetable, Refresh school names). Everyday work and expert/technical tools are mixed together, which undoes much of the six-control calm in the header. → **A2**, MEDIUM.
- *Codex's opinion, which Lane C does not adopt:* the warning dialog "exposes high-risk edit actions immediately". Those actions *are* the repair path, and each opens a preview before anything is saved. Keep them.

Codex cost: 2.43 M input tokens (2.34 M cached), 6.7 k output, on the operator's ChatGPT plan.
