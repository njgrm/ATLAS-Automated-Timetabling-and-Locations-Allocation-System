# Truth fixes: values on screen that don't check out (from two Codex audits + Lane C check)

Issued by Lane C, 17:25. Sources: `docs/reviews/codex-live-truth-e75d6b8f.md` (live, browser) and
`docs/reviews/codex-code-truth-4c515b01.md` (code). Lane C checked each claim before assigning it. Anything a scheduler
would act on wrongly is a demo blocker. Every owner: real staging data, 1366x768, `scripts/qa/ux-audit.js` clean on the
pages touched, commit and push wip every 30 min, one line per fix in the handoff with before/after on-screen words.

## A2 c15 (running) — add to the grade-identity packet (same bug class)
- **BLOCKER** `pre-generation-draft.service.ts:735-739`: the grade time window is looked up with `gradeLevelId`, so
  sections miss their grade window and fall back to school-wide hours; the draft shape is keyed by the id.
- `published-schedule.service.ts:709` sends the id as `gradeLevel` and `public-schedule-grade.ts:12-15` trusts any 7-10
  value first (legacy ids 7/8 map to Grades 9/10): send the resolved grade.
- `official-program-docx.service.ts:140,212,285` prints/chooses by `gradeLevelName ?? gradeLevelId` ("GRADE 17").
- Sorting by `gradeLevelId`: `Sections.tsx:652`, `workbook-export.service.ts:625`.
- `LockPanel.tsx:108,533` shows "Subj #id"/"Section #id": show "Unknown section" and block the action.

## A8 (after c4, before c5) — server truth
- **BLOCKER** `faculty.router.ts:169`, `section.router.ts:267,465`: `schoolYearId = activeYear?.id ?? 1` in write
  paths. Fail closed with a typed error; never default a year id.
- **BLOCKER** `generation-preflight.service.ts:541-558,801-803` ignores `isPlaceholder`. **Lane C ruling:** a
  placeholder-owned class is a third state, "on a to-be-hired teacher": it does not count as a real owner in readiness
  or coverage figures, it is listed by name, it does NOT block generation (A8 c3 gap rules) and it does not block
  publication (the operator kept the 14 placeholders on purpose), but publish shows "12 classes are on to-be-hired
  teachers" in words.
- `teaching-load-automation.service.ts:1209` hire estimate uses the fixed 30 h, not the saved workload policy.
- Exports: "TOTAL MINUTES PER DAY" is a weekly total (`workbook-export.service.ts:1065-1068`,
  `room-program-export.service.ts:216-219`): label it per week.

## A9 c8 (after c7) — Dashboard and Campus truth
- **BLOCKER** Dashboard readiness says "Timetable made and checked" while Class Schedule says "No 2023-2024 timetable
  yet". Every Dashboard readiness line must read the same source as its page.
- Rooms: "Teaching Rooms 78/103" (Dashboard) vs "78 of 78 teaching rooms are ready" (Campus); "0 rooms need something
  fixed, in 1 building" while a building has no rooms; "100%" beside "0 teaching rooms ready". One denominator, one
  definition, used everywhere; a building with no rooms is a thing to fix.

## A6 (in its c9 follow-up, before the cover window) — placeholders are not staff
- Teachers "WITH LOAD 34/34" counts the 14 placeholders; Subjects "MISSING COVERAGE 0" / "Full coverage" while Teaching
  Load says 72 classes need a real teacher. Every count uses the three states (real / to-be-hired / open) and says which.

## A3 c16 (after c15) — no codes on screen
- Teachers shows raw subject codes (`STE_APPLIED_PHYS 1, STE_RESEARCH 1`, `TLE_ICT_EXP`, `SCI_BIO`): show subject names.
  Sweep every page for enum/code rendering (the code audit's class 6) and fix what you find.

## For the operator (decision, not a code fix)
Year Setup and Teaching Load history list 2029-2030, 2030-2031, 2031-2032 as "past" years. They are rollover drill years
on live data, dated in the future relative to 2023-2024. For the demo they will confuse. Options: leave them; mark them as
test data (hidden from lists); or rename. Lane C will not change live data without the operator.

## Addendum 20:10 (train 10 re-check)
- **A6:** Teaching Load header read "81% staffed" in one staging walk and "73% staffed. 72 classes need one." an hour
  later on the same build and data. Find why (placeholder counting? load order?) and make it one definition, stable.
- **A8:** /subjects first load took 20.5 s and fell back to "Using saved data" (EnrollPro slow or a timeout). A scheduler
  waiting 20 s thinks it is broken: show the saved catalog immediately and refresh in the background, with a receipt.
