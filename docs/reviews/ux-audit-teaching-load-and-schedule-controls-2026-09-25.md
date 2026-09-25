# UX/correctness audit — Teaching Load terms, and post-publish schedule controls

- **Date:** 2026-09-25 · **Lane:** C (Claude Code) · **Served build:** `index-DNzys7Zh.js` (release `b6687fee`)
- **Origin:** `https://njgrm.buru-degree.ts.net` (asserted) · Claude in Chrome, operator session (`officer`, Admin),
  1366×768 window at 125% scaling. 390×844 **UNPERFORMED** (window would not resize).
- **Lens:** older, non-technical scheduler. **Authority:** operator authorized data changes for audit B.
- **Data changed: none.** The one write attempted (a teacher-leaving revision) was rejected by the server.

Tally: audit A 9 findings (2 correctness), audit B 11 findings (3 blocking the workflow).

---

## A. Teaching Load — terms, wording, breakdowns

Opened: the teacher list, Karen Tolentino's row and workload panel (a rotating-Science teacher), the Sections
tab and GR7 Luna's staffing panel.

**What is correct:** Teaching Load matches the Class Schedule — every GR7 Luna subject shows the same teacher in
both places for Term 2. Load arithmetic is internally consistent: for rotating subjects, a teacher's load is their
busiest term (Tolentino: T1 3.8h, T2 7.5h, T3 7.5h → 7.5h).

### Correctness

A1. **"Sections" counts class-terms, not sections.** Tolentino shows "5 sections"; she teaches 3 sections
(Mabini, Sampaguita, Tulip) — 5 is the number of section×term classes. The same inflation applies to every
rotating-subject teacher. *Fix:* count distinct sections, or label it "5 classes across 3 sections".

A2. **Two different caps.** The page summary says "Standard 30h · Hard cap 40h"; the teacher panel's bar says
"30h standard / 30h cap". One of them is wrong. *Fix:* one source for both.

A3. **Advisers 0 / Advisory credit 0h (verify).** Every section has a homeroom adviser in a real school; zero
advisers means advisory credit is missing from every teacher's load. May be an upstream (EnrollPro) sync gap.

### Wording and clarity

A4. **Technical words throughout:** "Teaching load truth", "Required pairs", "Unassigned pairs",
"264/264 pairs staffed", "Source not verified", "available from ATLAS runtime cache while upstream verification is
unavailable", "HG excluded", "Zero-load". *Fix:* "Subjects needing a teacher", "All 264 classes have a teacher",
"Working from saved data — EnrollPro could not be reached".

A5. **The load breakdown is written as maths jargon:** "Load arithmetic · Total classes sum 18.8h · Rotation
deduction −11.3h · Actual teaching 7.5h · Rotational groups · Peak weekly T1/T2/T3". *Fix:* "Busiest term:
7.5 h/week (Term 2 and Term 3). Science rotates each term, so it counts once."

A6. **Subject codes instead of names** in Handled classes and Section staffing: `SCI_CHEM`, `SCI_ES`,
`SCI_BIO`, `TLE_AFA_EXP`, `STE_APPLIED_CHEM`. *Fix:* show the subject name; keep the code for experts only.

A7. **Rotating classes have no term label in the Section view** — Luna lists Biology, Chemistry, Earth Science
and three TLE Exploratory subjects with teachers but no "Term 1/2/3", so a reader sees 12 subjects for a
section whose weekly schedule shows 8. "Shares one weekly lane across terms" is jargon. *Fix:* label each
rotating subject with its term; explain "one Science period each week, a different topic each term".

A8. **Guidance contradicts the page.** Tolentino's panel says "Prioritize unassigned sections from the shortage
grid" while the page reports 0 unassigned. *Fix:* only show that guidance when something is unassigned.

A9. **List numbers do not say they are per-term peaks.** "7.5h · 25%" reads as annual. *Fix:* "7.5 h/week
(busiest term)".

---

## B. Schedule controls — swap, teacher leaving, manual edit, conflicts

Ran on the published Term 2 schedule, GR7 Luna.

### What works

- **The safety net holds.** Reassigning Karen Tolentino's 25 classes to Jonathan Villanueva was **rejected by the
  server**: Villanueva already teaches GR9 Orchid at 1:45 PM Mon–Fri, the same slot as GR9 Tulip. No revision was
  created and the published schedule is unchanged.
- **The revision review is well designed:** "Schedule a published repair" shows every changed class as
  *Current published* vs *After effective date*, asks for an effective date ("tomorrow or a later school day")
  and a reason for the audit trail, and says plainly that earlier dates keep the original schedule.
- The Teacher-leaving wizard's five steps are clear; the term control now shows "Term 2"; the drift banner is calmer.

### Blocking the workflow

B1. **Swap on a published schedule is broken and shows a developer error.** More → Swap sessions lets the user
pick two classes, then fails with a raw API message — `POST /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/published-revisions (use the ../published-revisions/swap action…)` — shown **twice**, overlapping the
dialog buttons. The server supports a revision-based swap; the client still calls the direct-edit path. *Fix:* route
published swaps through the same "Schedule a published repair" revision flow as teacher leaving; never show API
paths to users.

B2. **Conflicts are found only at the final click, and the message misleads.** The wizard promises "ATLAS
previews blockers before anything is saved", Step 4 "Preview changes" was skipped and Step 5 "Preview result" shows
no numbers. The conflict appears only after the effective date and reason are typed: "Cannot revise a published
schedule while the merged entries contain hard violations. Check the effective date and reason, then try creating
the revision again." — the date and reason are not the problem, no conflicting class is named, and there is no next
step. *Fix:* run the conflict check in Step 4; name each clash ("Villanueva already teaches GR9 Orchid at
1:45 PM Mon–Fri"); offer "Choose a different teacher for these classes".

B3. **Manual edit is a dead end on a published schedule.** Manual Edit says "select a class on the schedule grid
first, then open Move, Change room, or Swap"; clicking a class on the published schedule only flickers the page
— no selection, no actions. So a user cannot move one class after publishing, and a manual conflict cannot be
created to test the conflict explanation. *Fix:* on a published schedule, a class click opens a read-only card with
"Change this class from a date…" leading to the revision flow.

### Clarity

B4. **"Published schedule — view only" sits beside "Start swapping" and "Generate".** The page tells the user it
cannot be changed while offering buttons that change it.

B5. **Warning repeated four times in jargon** on the Teacher-leaving sheet ("effective-date revision",
"published run", "sole temporal authority"). *Fix:* once: "Changes start on a date you choose. The published
schedule stays as it is before that date."

B6. **Affected classes look duplicated.** "SCIENCE · GR7 - Mabini · SPS" appears twice (Chemistry in Term 2,
Earth Science in Term 3) with no subject or term; "grid blocks" is jargon.

B7. **Stale state after cancelling a swap.** "Class A selected. Choose the second class to swap times with."
stayed on screen after Cancel and after closing the panel, and followed the user to the Manual Edit page.

B8. **The layout jumps during swap**, pushing the grid ~25 px down after the first pick, so the next click lands on
the wrong row; the chosen class has no visible highlight.

B9. **Draft ("Pre-Generation") shows the published classes, then empties** once it loads, under three competing
buttons ("Return to published", "Generate", "Generate when ready") and a "Published schedule — view only" badge.

B10. **"Schedule history" is disabled with no reason given.**

B11. **The teacher picker has no accessible name** (screen readers announce it unnamed); typing a name and
pressing Enter does not select it — the option must be clicked.

---

## Suggested order

B1 → B2 → B3 (the post-publish change path: swap, reassign and move all go through one revision flow with the
conflict check up front), then A1–A2 (wrong numbers), then B4–B7 and A4–A7 (wording), then the rest.
B1–B3 and B6–B9 are client; B2's named-conflict detail may need the server to return the clashing entries.
