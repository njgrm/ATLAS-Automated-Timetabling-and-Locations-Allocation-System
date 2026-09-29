# A3 c17 — Teachers profile grouping, hours, to-be-hired identity, saved weekly maximum

**Integrated to `main` at `3947aa5b`** (range `aeb1bd2c..3947aa5b`, 13 commits, client-only, no server / schema / data touched).
`0 fixes live and seen / 7 integrated / 0 dropped`. Browser-verified on **staging** at 1366×768 on real data, origin
`http://127.0.0.1:5244` (port 5244, killed after the walk). **Not deployed** — Lane A4 owns the cutover.

Screenshots: `C:\Users\njgro\AppData\Local\Temp\opencode\pw-mcp-output\`
`a3c17-teachers-roster.png` · `a3c17-profile-placeholder.png` · `a3c17-profile-assigned.png` ·
`a3c17-profile-real.png` · `a3c17-timetable.png`

## Before → after, per row (on-screen words)

| Row | Before | After |
|---|---|---|
| 1 grouping | `MAPEH`, a `MAPEH` code line, then one line per section: `GR7 Luna`, `GR7 Bonifacio`, `GR8 Maka-Diyos` | `MAPEH` heading, code line gone, then **`GR7 Grade 7` with chips `Aguinaldo · Bonifacio · Luna · Mabini · Rizal`** and **`GR8 Grade 8` with `Maka-Diyos · Makakalikasan · Makatao`** — the requester's worked example, rendered |
| 2 hours | `3.8h` badge only | `8 classes · 30h a week` beside the `3.8h` badge; `3.8h each` appears **only** when it reproduces the total (240-min subjects), never beside a total it contradicts |
| 3 header | `#ID-PENDING` + `ACTIVE TEACHER` | `To be hired` badge in the roster's Temporary colours; real teacher keeps `#1000018` + `Active teacher`; a real teacher with no employee ID shows nothing |
| 4 names | `— TO BE HIRED, MAPEH`, `1 — TO BE HIRED, TEACHER` | `To be hired: MAPEH`, `To be hired: TEACHER 1` — on the **same string** across Teachers, Teaching Load and Timetable (asserted equal, not merely similar) |
| 5 item 2 | `…above the 40h weekly maximum…` | reads the **saved** maximum off the roster (32h teacher → "32h"); label and count untouched |
| 6 floor | `ROSTER IDENTITY` etc. at 10.4–11.2px, uppercase | 14px sentence case; **zero** elements under 14px in the dialog, including inside A6 c10's nested permission block |
| 7 resize | Review load clamped at **672px**; left drag selected text | opens at 1298px (95vw); **left handle 1298→1078**, right handle 1078→1178, far-left clamps at 95vw, no horizontal scrollbar |

## Gates (literal results, final tree `3947aa5b`)

- `test:a3-c17-teacher-profile` **82 pass / 1 fail** — the 1 is `timetable-cell-info` row 8, pre-existing and
  proven inherited (`git diff origin/main HEAD -- CenterWorkspace.tsx` empty).
- `test:a6-c11-teacher-truth` **6/6** · `test:a6-c10-cover-class` **17/17** — A6's own suites, after the merge.
- `test:encoding` **1/1** · client `tsc --noEmit` **5 errors, all pre-existing** (3 missing `playwright`, 1
  implicit-any, 1 no-overlap), none in my files. `git diff --check` clean.
- Browser audit with the Profile open at 1366×768: **0 MAJOR**, no mojibake, no `More filters`, no `…`,
  no sideways scroll, no text under 14px.

## Two things I changed in other lanes' files, and why — both needed a decision

1. **`TeacherSubjectPermissions.tsx` (`52e3b29b`, mine).** A6 c10's "Teaching permissions" heading was
   `text-[0.7rem]` = **11.2px**, and it renders *inside* the profile dialog, so row 6 governs it. Raised to
   `text-sm`, de-shouted to sentence case. No behaviour change; A6 c10's suite is green.
2. **`a7-c8-type-scale.test.ts` A7C8-2 (mine).** A5 c8 has now landed and deleted the last `More filters`
   disclosure, so that ratchet's allowlist was stale and **red on main**. The row's own contract says to delete
   the entry in the same commit that removes the occurrence, so the list is now empty and the row is a hard fail
   on any occurrence — the state it always promised. **This was a red gate on `main`; it is now green.**

## Rejected by me, kept visible in the tests

The executor made the subject total derive from a *rounded* per-section figure, so 8 sections of a 225-minute
subject read **"30.4h a week"** — not that teacher's load, and contradicting the card's own server-fed 30h. I
rejected that, then also rejected its fallback of restating the figure as "225 min each" (a second unit beside a
`3.8h` badge answering the same question). Final: the total is always the truthful sum, and the "each" clause is
**omitted** when its hours form cannot reproduce it. The requester wrote "and, **if useful**, '3.8h each'" — that is
permission to omit. Both superseded forms are preserved in comments and assertions, per the additive-evidence rule.

## Open, for the next cycle — none blocking this train

- **F-1 (needs an account, not a fix).** The Teaching Load and Timetable **rendered** views of row 4 could not be
  walked: `/teaching-load` returned `WORKSPACE UNAVAILABLE — needs a signed-in scheduler account with a school
  assignment` on the staging QA account, and the Timetable had no teacher cells in this school-year state. The
  string-equality contract is proven at every call site and by the two decisive mutants, so this is an **evidence
  gap, not a code gap** — but it needs an account that can open those surfaces before row 4 is *seen* there.
- **F-2 (follow-up, pre-existing, NOT introduced here).** `TeacherWorkloadAuditSummary.tsx:183` calls
  `formatFacultyInitials({ firstName, lastName })` without `isPlaceholder`, so a to-be-hired record shows `M—` in
  that audit summary. `TeacherWorkloadAuditRow` does not carry the field, so the fix is a type+call-site change in
  files this range does not touch. The same row's `displayName` (`:182`) *does* route through the formatter, so
  row 4's defect class is not reproduced. Named so it is not mistaken for closed.
- **F-3 (ownership, for A4).** Two merges were needed because `main` moved 70 and 50 commits mid-flight, both
  times touching `FacultyProfileSheet.tsx`, `Faculty.tsx`, `types.ts` and `package.json` alongside A6 c10/c11. Both
  unions were resolved keeping **both** sides and verified: A6 c11's `loadTruth.*` counts, A6 c10's four props
  and both permission handles, A5 c8's 14 `verifyUpstream` sites, and A2 c15's `gradeNumberOf` authority all
  survive. Independent QA diffed the union both ways and found nothing dropped. **If A4 pins a release commit,
  pin `3947aa5b` and re-check those five files if `main` has moved again since.**

Evidence: `docs/prompts/a3-c17-teachers-profile-2026-09-29.md` (packet). Worktree
`E:/ATLAS-worktrees/lane-a3-c17-teachers-profile` — `RETIRE_AFTER_INTEGRATION`, branch pushed, clean.

## Lane C -> A8 unblock (a8-ds-unblock), 29 Sep 23:53 — the operator rolled over AGAIN: live is now 2025-2026
- Live active year is now **EnrollPro id 4, 2025-2026** (ATLAS context enrollpro-verified, drift aligned). Terms T1-T3
  2025-06-08..2026-04-xx; EnrollPro active-term answers 200 activeTerm null again, while ATLAS's context reports activeTerm
  T3 with source atlas-unverified. Reproduce on 2025-2026, not 2024-2025: take a FRESH backup of live (Lane C's
  livedump pattern, read-only) rather than the pre-drill dump.
- **New suspect:** the rollover mirror row keeps syncStatus `setup-review-required`
  (enrollpro-rollover.service.ts:1825/1851) and NOTHING in atlas-server/src ever moves it on (only a disposable-baseline
  script sets `synced`). Check whether any readiness, capability, dashboard or Setup check reads it (directly or via
  rollover-status / RolloverGuidanceCard); if so that is the permanent "setup not done". The fix is a transition when the
  scheduler finishes the year's setup (or derive it from the real checks), not a manual DB edit.
- Include the term picker: which term the timetable scopes to when EnrollPro has no current term.
