# System walk 2 — Teaching Load and faculty pages (2026-09-26)

**Release:** `26f7c907` (chunk confirmed). **Method:** read-only `atlas-browser-qa` on Claude in Chrome,
operator session, 1536×730. Tally **9 observed / 0 blocked / 0 unperformed**. EnrollPro is down. Console:
0 errors. **Perspective:** a veteran scheduler checking that every class has a teacher and every teacher a
fair load.

## Verdict

Teaching Load is the strongest page so far. It opens with the answer ("Teaching Load looks ready" / "264
of 264 classes have a teacher."). Its outage banner is the plain one the other pages should copy. The
teacher detail tells you what to do in one sentence, and one teacher's figures agree on all three pages.
The weak spots sit at the edges. **Faculty Preferences contradicts itself**: the tab says 42 missing, the
list says none. The "review this teacher" prompts lead to advice with no action. And the history page
shows a year that is two years back without saying why.

## Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **Faculty Preferences: count and list disagree.** The tabs read "Submitted / Draft / Missing 42 / All", but both "Missing" and "All" show "No teachers found — No teachers match the current filter." A scheduler chasing missing preferences sees 42 and cannot open one. Cause not diagnosed. It may be a list that depends on the unreachable EnrollPro, but if so the page must say so. | P5 | **HIGH** |
| 2 | **"Review" prompts with nothing to do.** Teachers shows "NEXT TEACHER TO REVIEW: AGUILAR… below the 30h standard and can still receive assignments". The Teaching Load detail says "WHAT TO DO: This teacher can take more classes (up to the 30h standard)." But there is no link to a class that needs a teacher (and all 264 already have one), and no "find classes for this teacher". The prompt reads as a to-do that cannot be done. Either offer the action or call it information ("Has room for 15h more"), not "review". | X2 | MEDIUM |
| 3 | **No totals for under- and over-load.** Teaching Load has filter chips "Below standard" / "Above standard" but no counts; Teachers counts "ABOVE WEEKLY MAX 0" only. The first question a head teacher asks is *how many are under-loaded?* | P1, P4 | MEDIUM |
| 4 | **History shows 2029-2030, not last year.** `/teaching-load/history` opens "Read-only history — 2029-2030" while the active year is 2031-2032. The page gives no year picker and no reason why it skips 2030-2031. The year-setup link points to `?schoolYearId=8`. Verify whether 2030-2031 exists and why it is not the default. | P2 | MEDIUM (verify) |
| 5 | **History rows are cryptic.** "FIL, 1 subject, FIL — FIL, Gold, Diamond, Rose": the code is repeated and the sections have no grade ("Gold", not "GR9 Gold"). The active-year page says "Filipino GR7 Luna…". History should use the same format. | P2 | LOW |
| 6 | **Jargon on the concern pages.** Teacher Concerns: "review the authority that binds generation". Room Preferences: "before committing room changes into the active run". Plain versions: "what ATLAS must respect when it builds the timetable"; "before the room changes go into the draft". | P6, P7 | LOW |
| 7 | **Button style is inconsistent.** "PREVIEW SUGGESTED ASSIGNMENTS" is in capitals beside "Review teachers" in sentence case. | P1 | LOW |

## Keep

- The headline answer first: "Teaching Load looks ready" and "264 of 264 classes have a teacher", with "% STAFFED 100%" and "CLASSES WITHOUT A TEACHER 0".
- **The outage banner to copy system-wide:** "EnrollPro could not be reached, so ATLAS is using the last saved sections. Recent changes in EnrollPro may be missing." It says what happened, what you are seeing and what might be wrong. Walk 1 finding 4 should reuse it, with the saved date added.
- The teacher detail: "Teaching 15h / 30h standard · 30h max for this teacher", "ROOM FOR MORE CLASSES 15.0h", the classes taught, and one "WHAT TO DO" line.
- The disabled Save says why: "Save stays disabled until you prepare a draft change."
- The archived year is plainly read-only, and the page says exactly what cannot be done.
- **Cross-page agreement:** AGUILAR's 15h / 30h and four sections match on Teachers, Teaching Load and the Assignments redirect.
- `/assignments` → `/teaching-load` and `/faculty` → `/teachers` redirect cleanly.

## Hand-off

All findings go to **Planner A** (non-timetable). Finding 1 first.

`subagent_tokens`: 91,745 (39 tool calls).
