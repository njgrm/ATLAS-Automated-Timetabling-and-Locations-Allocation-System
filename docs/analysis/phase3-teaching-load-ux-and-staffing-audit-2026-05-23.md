# Phase 3 Teaching Load UX and Staffing Audit

Date: 2026-05-23  
Scope: Live Tailnet `Teaching Load` audit after the latest Copilot UX pass, with staffing-impact verification against live API truth and current source.

## Verdict

`Teaching Load` is still not closure-grade.

Two different problems are now mixed together:

1. The page is visually calmer in a few places than earlier builds, but the manual assignment workspace is now less efficient for schedulers.
2. The staffing-impact model is only partially trustworthy. Some parts are mathematically correct, while others are still operationally misleading.

## Live Verification Summary

Environment:
- Tailnet: `https://njgrm.buru-degree.ts.net`
- Login: officer account
- School: `schoolId=1`
- Active school year: `55`

Verified live API results:
- `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
  - `assignedPairs=726`
  - `rawAssignedPairs=960`
  - `unassignedPairs=236`
  - `rawUnassignedPairs=2`
  - `syntheticPlaceholderPairs=0`
  - `emptySectionRows=154`
  - `currentYearRowsMissingOwnership=1`
  - `zero-load real teachers=8`
- `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
  - zero coverage:
    - `SCI_ES = 82 / 82 uncovered`
    - `STE_ROBOTICS = 2 / 2 uncovered`
  - partial coverage:
    - `TLE_FCS_EXP = 54 / 58 uncovered`
    - `SCI_CHEM = 35 / 82 uncovered`
    - `ENG = 23 / 82 uncovered`
    - `FIL = 22 / 82 uncovered`
    - `MATH = 12 / 82 uncovered`
    - `AP = 6 / 82 uncovered`
- `POST /api/v1/faculty-assignments/report/staffing-needs`
  - raw completeness:
    - `236` uncovered rows
    - `53100` missing minutes
    - `885` missing hours
  - concurrent weekly shortage:
    - `201` concurrent rows
    - `45225` missing minutes
    - `753.8` missing hours
    - `recommendedNewHires=25.1`
    - `rotationAdjustedMinutesPerWeek=7875`
- `POST /api/v1/faculty-assignments/auto-fill`
  - still fails live with `500 SERVER_ERROR`
  - error points to `atlas-server/src/services/teaching-load-automation.service.ts:701`
  - underlying DB error: Postgres `25P02 current transaction is aborted`

## What Is Correct Right Now

### 1. Teacher-side rotation math is real

The per-term / rotation-family teacher load logic is active and reflected in live summary payloads:
- `sectionTeachingHoursRaw`
- `rotationFamilyOvercountHours`
- `rotationFamilyLoadDetails`
- `policyCreditedHours`

This means the teacher-side calculation can distinguish:
- raw subject-row load
- overlapping family rows
- adjusted weekly teaching load
- credited load after advisory and ancillary rules

This part is materially better than the earlier misleading `Teacher X` era.

### 2. Staffing-needs now separates raw completeness from concurrent shortage

The newer staffing report is no longer using the old `* 30` heuristic.  
It now correctly computes:
- raw uncovered row completeness
- concurrent weekly shortage after rotation overlap adjustment

The concurrent shortage number is therefore directionally correct as a rotation-aware hours figure.

### 3. `TLE` umbrella subject is no longer the active staffing row

Live subject coverage now operates on:
- `TLE_AFA_EXP`
- `TLE_ICT_EXP`
- `TLE_FCS_EXP`

The stale umbrella `TLE` load-bearing behavior is gone from the active staffing surface.

## What Is Still Wrong

### 1. Auto-Fill is still broken

This is the most concrete functional blocker.

Live `POST /faculty-assignments/auto-fill` still returns `500`.

The reproduced root cause is in `atlas-server/src/services/teaching-load-automation.service.ts:701`:
- the code catches a duplicate-write path inside a Prisma transaction
- then continues issuing queries inside the same transaction
- once Postgres aborts the transaction, later statements fail with `25P02`

Effect:
- schedulers cannot rely on the primary bulk-assignment repair tool
- the page looks like it supports recovery, but the main recovery action is not operational

### 2. The staffing report is still too optimistic about internal recovery

`report/staffing-needs` currently returns `internalCrossTrainees` such as:
- `MAPEH`
- `MATHEMATICS`
- `FILIPINO`
- `ENGLISH`
- `TLE`
- `SOCIAL STUDIES`
- `VALUES`

The service currently builds this from spare capacity across other departments in
`atlas-server/src/services/teaching-load-automation.service.ts`, but it does not prove that those departments are:
- actually qualified for the shortage subjects
- allowed by subject multi-owner rules
- policy-allowed to absorb the gap

So the spare-capacity list is mathematically real but operationally misleading.

This is especially bad for a page that is already mixing:
- zero-coverage science
- `TLE_FCS_EXP`
- `FIL`
- `STE_ROBOTICS`

Schedulers can easily read the report as "we already have enough internal capacity," when that capacity may not be qualified capacity.

### 3. The report still over-centers a single "primary shortage department"

Top-level staffing report fields still collapse the shortage into one `department`, currently `SCIENCE`.

That is incomplete because the actual live shortage mix spans:
- `SCIENCE`
- `TLE`
- `ENGLISH`
- `FILIPINO`
- `MATHEMATICS`
- `SOCIAL STUDIES`

This single-department anchor makes the modal read like a science staffing report even when the shortage is school-wide.

### 4. Integrity debt is still high

Live summary still shows:
- `emptySectionRows=154`
- `currentYearRowsMissingOwnership=1`

This means the UI is operating on a truth model that is better than before, but still not clean enough for closure.

### 5. Zero-load teachers still exist in departments that should absorb some current gaps

Live zero-load real teachers:
- `URSULA BELTRAN` (`FIL`)
- `TOMAS ENRIQUEZ` (`FIL`)
- `WENDY ILAGAN` (`MAPEH`)
- `VICTOR MACALINTAL` (`MAPEH`)
- `ZACARIAS NAVARRO` (`MAPEH`)
- `YOLANDA QUINTO` (`MAPEH`)
- `XAVIER TUASON` (`MAPEH`)
- `ALICIA YAMBAO` (`MAPEH`)

This does not prove the auto-assignment policy is wrong by itself, but it does prove the current staffing surface still needs:
- better in-department recovery logic
- clearer manual recovery workflow
- better explanation for why some zero-load teachers remain untouched

## UX/UI Audit

## 1. The page still spends too much vertical space before the actual work area

The top of `Teaching Load` now stacks:
- the overview cards
- the data health trigger band
- the synthetic coverage banner when present
- a large teacher identity card
- a persistent explanation panel
- warning banners

By the time the scheduler reaches subject assignment controls, too much vertical room is already consumed.

Relevant source:
- `atlas-client/src/pages/FacultyAssignments.tsx`

Effect:
- the page looks calmer in screenshots
- but it is worse for repeated manual assignment work

## 2. The selected-teacher panel is oversized for a dense scheduling tool

The selected teacher panel now includes:
- avatar and identity block
- large current-loading panel
- load preview bar
- a large persistent blue "Load Calculation Details" panel

The explanation is useful, but the current footprint is too large for an always-visible area.

Effect:
- explanation improved
- workspace efficiency regressed

Better direction:
- keep the explanation durable
- compress it into a smaller inline stat/summary strip
- let a secondary reveal show the deeper breakdown

## 3. The left rail is still microtext-heavy and visually noisy

Teacher rows in the left rail still rely on very small text sizes and tight stacked signals:
- specialization
- department fallback
- percentage
- load bar
- draft dot
- assigned/unassigned icon

Relevant source:
- `atlas-client/src/pages/FacultyAssignments.tsx`

Effect:
- the roster is dense, but not actually restful to scan
- it still feels like debug instrumentation rather than a roster navigator

## 4. The subject assignment area is now too card-heavy

`SubjectRow` currently renders each grade group as a multi-column grid of cards:
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

Each section card carries:
- name
- specialization badge if any
- advisory/system state badges
- pending/saved/program-mismatch badge
- checkbox or lock
- optional `Take` / `Override`

Relevant source:
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`

Effect:
- visually polished
- poor for high-throughput manual scheduling
- the scheduler sees fewer assignable targets per viewport
- the grid encourages inspection, not fast placement

## 5. The subject rows still contain too much status decoration for every cell

The current row tries to explain all of these inline:
- pending current
- saved current
- pending other
- saved other
- DB conflict
- program mismatch
- advisory
- system assigned
- specialization identity

That is too much state at once for the normal assignment view.

Effect:
- the page is now less “broken looking” than before
- but still too cognitively loaded for operators

## 6. Action hierarchy is still mixed

This improved compared to earlier passes, but not enough.

The main page still surfaces:
- everyday assignment workflow
- maintenance reset
- integrity diagnostics
- staffing impact analysis
- auto-fill

These are all valid tools, but they are still too close together in the main operator space.

Effect:
- the page still feels like a combined scheduler + auditor + repair console
- not a focused daily teaching-load workspace

## 7. The staffing modal is smarter but still reads like an analytics report

The modal now explains raw vs concurrent truth better than before, but it still feels report-first rather than action-first:
- large panels
- shortage drilldowns
- strategy copy
- hiring framing

Relevant source:
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

Effect:
- the modal is more honest
- but still not calm enough for the operator workflow

The scheduler needs:
- what is missing
- what can be recovered manually now
- what truly requires a staffing decision

That hierarchy is still not strong enough.

## Why The Staffing Numbers Feel “Too Large”

The live `236 sections / 885 hours / 25.1 hires` output is not random.

It comes from two real layers:

### Raw uncovered completeness

Raw uncovered rows currently include:
- `SCI_ES = 82`
- `TLE_FCS_EXP = 54`
- `SCI_CHEM = 35`
- `ENG = 23`
- `FIL = 22`
- `MATH = 12`
- `AP = 6`
- `STE_ROBOTICS = 2`

That really is `236` uncovered subject-section rows.

### Concurrent weekly shortage

The system also removes rotation-family overlap and computes:
- `201` concurrent rows
- `753.8` concurrent hours
- `25.1` full-time faculty equivalents

So the page is not wrong to say the shortage is large.

What is wrong is:
- the internal cross-trainee framing is too loose
- the modal still does not clearly separate “manually recoverable with current qualified teachers” from “true hiring or contract shortage”

## What Closure Still Requires

### Truth-model fixes

1. Fix `Auto-Fill` transaction handling so the main recovery action actually works live.
2. Make `internalCrossTrainees` qualification-aware instead of counting all spare capacity from unrelated departments.
3. Stop anchoring the staffing report to a single top-level `department` when the shortage is mixed.
4. Keep the current concurrent shortage math, but classify shortages into:
   - recoverable with currently qualified active teachers
   - blocked by ownership/qualification policy
   - likely true staffing shortage

### UX/UI fixes

1. Compress the selected-teacher metrics area substantially.
2. Replace the current subject-section card grid with a denser, scheduler-first assignment surface.
3. Keep durable explanation, but reduce its footprint and move deeper diagnostics to progressive disclosure.
4. Keep maintenance and data-health tools available, but move them further away from day-to-day assignment actions.
5. Reduce microtext and badge density in the left rail and section cells.
6. Reframe the staffing modal around operator decisions:
   - what can I fix now
   - what cannot be fixed with current qualified teachers
   - what truly suggests new staffing demand

## Final Assessment

`Teaching Load` is more truthful than it was before, but it is still not finished.

Current state:
- teacher rotation math: mostly correct
- staffing raw vs concurrent split: directionally correct
- auto-fill: broken
- manual assignment workspace: too inefficient
- staffing guidance: still too broad and too technical

So the correct status is:

- `GO` for partial truth-model improvement
- `NO-GO` for workflow closure and scheduler usability
