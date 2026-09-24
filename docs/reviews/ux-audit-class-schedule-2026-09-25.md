# UX/UI audit — Class Schedule (`/timetable`), older non-technical scheduler lens

- **Date:** 2026-09-25 · **Lane:** C (Claude Code) · **Mode:** read-only (no save, generate, publish or cell selection)
- **Origin:** `https://njgrm.buru-degree.ts.net` (asserted) · **Served build:** entry `assets/index-D90Rg0kl.js`
  (the C7 release that replaced `37e0c85b`'s `index-qbOXyMnr.js` during this session)
- **Browser:** Claude in Chrome, operator's existing session (`officer`, Admin), window 1366×768 at 125% scaling
  (CSS viewport 1536×730). **390×844: UNPERFORMED** — the window would not resize.
- **Persona:** a school scheduler in their 50s–60s, comfortable with Word/Excel and printed class programs, not
  with software jargon; reads at arm's length; afraid of breaking the published schedule.

Tally: 12 findings (4 HIGH, 5 MEDIUM, 3 LOW) · 1 row unperformed · 0 console errors.

## Findings, ranked

### HIGH — likely to stop or scare the target user

1. **An alarming banner on a published schedule, with no plain explanation.** The status line reads
   "Published · Schedule information changed — This schedule no longer matches the latest school information.
   Refresh before publishing." It does not say *what* changed, whether the published schedule teachers see is
   wrong, or whether anything must be done now. "Refresh before publishing" contradicts "Published".
   *Fix:* say what changed in one sentence ("2 teachers and 1 room were edited after this schedule was
   published"), say whether the published copy is still valid, and give one clear next step.

2. **"Generate" sits beside "Published schedule — view only".** The most destructive-sounding action is a normal
   button next to the published state, one click from the thing the user most fears breaking. *Fix:* hide
   Generate on the published view, or move it behind the Draft tab / a "Start a new version" flow with a
   confirmation that states what happens to the published schedule.

3. **Warning triangles with no explanation.** Many cells (MAPEH, AP, MATH, ENG every day) show an amber ⚠ that
   has no tooltip, no label and no accessible name — hovering shows nothing, and the cell's only label is
   "Select MAPEH for GR7 - Luna, Mon 7:30 AM". The user sees half the week flagged and cannot learn why or
   whether it matters. *Fix:* a tooltip/popover on hover and tap with the warning in plain words and whether
   action is needed; add the reason to the accessible name.

4. **Text is too small for the audience.** Subject and teacher lines are 12px (CSS), time labels 12px with a
   grey end time, and the flag-ceremony label 9.6px. For readers at arm's length this is the difference between
   reading the schedule and squinting. *Fix:* 14–16px for cell text and times, ≥12px for every label; let the
   grid scroll rather than shrink.

### MEDIUM — slows the user down or causes doubt

5. **About 8–10 seconds of loading, with jargon.** The grid is blank behind "Loading timetable: navigation is ready
   now; the grid fills as soon as the latest run resolves." `GET /api/v1/sections/summary/10?schoolId=1` took
   **7.9 s** and gates the grid. *Fix:* speed up or defer that call; message: "Loading the class schedule…".

6. **"View only" cells behave as if editable.** Every cell has a drag handle (⋮), a pointer cursor and a "Select…"
   label while the header says view only. Mixed signals make a cautious user afraid to click anything. *Fix:*
   drop handles and pointer cursor in view-only mode; a click opens a read-only detail card.

7. **Everyday tasks are hidden under "More".** "Swap sessions", "Teacher leaving / Reassign load", "Place
   unresolved sessions" and "Plan draft" live in a scrolling menu next to "Expert tools". The user will not look
   for daily work under "More". *Fix:* surface the 2–3 most common tasks as labelled buttons; keep Expert tools
   separate.

8. **Jargon and codes.** "Runs", "Draft", "Setup", "Policies" tabs; "Active Term: T2"; room code "G7AW"; program
   groups "SPA", "SPS" in the section picker. *Fix:* "Past versions" for Runs, "Term 2" instead of "T2", explain
   or expand codes on hover.

9. **The term picker is truncated.** The closed control shows "TERM…" in a wide box, so the user cannot see which
   term they are looking at without opening it. The open list is clear ("TERM 2 (active)"). *Fix:* show the
   full label ("Term 2 (current)").

### LOW — polish

10. **Inconsistent name casing** — "P. CRUZ", "I. GARCIA" beside "R. Santos", "J. Cruz". Looks like a data error to
    a careful reader. *Fix:* normalise display casing.
11. **The school name is cut off** in the sidebar ("ATLAS HINIGARAN NATI…"). *Fix:* wrap to two lines.
12. **The page-level tabs are faint and small** (12px, light grey), so it is not obvious they are tabs. *Fix:*
    larger tab labels with a clear active underline.

## What works — keep it

- The grid itself reads like the printed class program: days across, times down, breaks as labelled rows.
- The section picker is searchable and grouped by grade and program; view type is three plain choices
  (Section / Teacher / Room).
- No global page scrollbar; the grid scrolls inside its region (§8).
- "Download schedules" is plainly worded.
- No console errors.

## Suggested order of work

1 → 2 → 3 (trust and safety on the published view), then 4 and 5 (readability and wait), then 6–9. Findings 1, 2,
3, 6 and 7 are client-only; 5 needs a server look at `sections/summary`.
