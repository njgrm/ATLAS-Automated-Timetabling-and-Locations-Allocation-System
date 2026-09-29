# A9 packet c5 — Past-year Teaching Load: calm, findable, answers the three questions

Issued by Lane C, 14:50. New branch/worktree from the main tip. Client first; a server read change only if a past
(not yet "kept") year cannot be read today — say so, keep it minimal, MEDIUM. Deadline: on main by **17:30**.
**Browser proof with REAL staging data** (staging QA login; `start-preview.ps1` is fixed at `aa2dcfdf`).
Shell calls are force-killed at 20 min; builds/suites detached at BelowNormal priority.

Evidence: `docs/reviews/codex-live-tl-history-3216d383/report.md` — live, scores 3/2/2/2, **REJECT_UX**.
Operator (14:40): "Archived teaching load page is also so bad in terms of UX/UI."

## Must fix
1. **2022-2023 is missing.** The year picker offers only 2029-2030 (a drill year). Every past year with a saved
   Teaching Load must be offered — including years that are past but not yet "kept as history" (2022-2023 after
   today's rollover). Most recent first. A7 c7 is hiding/marking the 2029-2032 drill years; follow its rule.
2. **Identity:** one calm heading "Teaching Load — 2022-2023 (past year, view only)". The sidebar/header "ACTIVE
   2023-2024" must not compete; the page says clearly which year you are looking at.
3. **Answer the three questions** within 2 clicks: "Who taught Grade 8 MAPEH?" (Subject and Grade filters; results
   show grade and section names), "What was Ms X's load?" (each teacher shows hours/week and number of classes),
   "Can I use last year's assignments?" (a plain pointer: "Suggest assignments on this year's Teaching Load uses last
   year's" if that is true — check; otherwise say nothing).
4. **Calm:** collapsed teacher rows (name · hours · classes), expand for subjects by plain name and "Grade 8 — Luna,
   Rose"; codes like `SCI_BIO` only in a muted detail. "5 subject s" -> "5 subjects". "Department not recorded" ->
   hide it. Filters never collide at 1366. Replace the long read-only warning with one line.
5. Reachable from the Teaching Load page as "Past years" (not buried under "More Teaching Load tools"), and from
   School Year Setup's past-year list.

## Rules
- Subtract: default view far shorter than today.
- Browser rows for Lane C: 2022-2023 offered; the three questions with click counts at 1366; no raw codes in the
  default view.
