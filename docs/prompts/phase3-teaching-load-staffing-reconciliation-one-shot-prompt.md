# Copilot Execution Prompt: Phase 3 Teaching Load Staffing Reconciliation One-Shot

## Objective

After the subject-contract `TLE` cleanup lands, reconcile the real remaining staffing blockers in `Teaching Load`.

This pass should focus on the current live blocker shape:

- science-family ownership topology failure
- TLE family-member distribution failure
- Filipino leakage and stranded in-department load
- integrity and reconciliation debt

This is not a placeholder pass. Placeholder masking is already gone.

It must also ensure auto staffing respects the corrected ownership-distribution rules and that the manual staffing workflow communicates those rules clearly and stays easy for schedulers to use.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-staffing-blocker-audit-2026-05-23.md`
- `docs/analysis/phase3-subject-contract-and-teaching-load-term-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-staffing-discrepancy-audit-2026-05-23.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- any recovery, coverage, ownership, autofill, and blocker-classification paths

## Facts To Treat As Settled

- Synthetic placeholder coverage is now `0`.
- The live blocker is now real ownership distribution and integrity debt.
- Umbrella `TLE` has now been manually deleted from the live subject catalog and must not be recreated by this pass.
- Active TLE contract is now only:
  - `TLE_AFA_EXP`
  - `TLE_ICT_EXP`
  - `TLE_FCS_EXP`
- Current live high-signal gaps include:
  - `SCI_ES = 0 / 82`
  - `TLE_FCS_EXP = 4 / 58`
  - `SCI_CHEM = 47 / 82`
  - `STE_ROBOTICS = 0 / 2`
  - `FIL = 60 / 82`
  - `HG = 79 / 82`
- `emptySectionRows` remain high.
- Rotation-family load accounting is visible in summary output, but family-member ownership is still broken.
- Auto staffing must respect the ownership-distribution rules that result from this pass.
- Manual Teaching Load editing must remain authoritative and easy to understand.
- Stakeholder reality now requires that some subjects can be baseline-qualified for more than one department.
  - Example: `STE_ROBOTICS` must support `SCI` plus `TLE`, not only one owner department.

## Scope

### In Scope

#### A. Science-family ownership redistribution

Required:

- inspect why `SCI_ES` remains fully unowned despite visible `SCI` department load
- inspect why `SCI_CHEM` remains partial while `SCI_BIO` is full
- repair current-year ownership distribution where legitimate
- do not treat `SCI_ES` as solved or ignorable just because it is not surfacing correctly in the current staffing-needs modal

#### B. TLE family-member redistribution

Required:

- inspect why `TLE_FCS_EXP` remains almost entirely unowned while other TLE family members are broadly distributed
- repair family-member ownership topology where legitimate
- do not recreate umbrella `TLE`
- ensure all TLE autofill/recovery logic works only on the surviving exploratory family rows

#### C. Filipino ownership leakage correction

Required:

- inspect why `FIL` ownership is still partially uncovered while many `FIL` teachers are low-load or zero-load
- reduce cross-department leakage for `FIL` where it conflicts with the department-first baseline
- recover stranded in-department `FIL` load where legitimate

#### D. Integrity and reconciliation cleanup

Required:

- reduce `emptySectionRows`
- resolve `missingOwnership` debt where legitimate
- make preview/apply parity truthful for `HG` and other small-gap subjects

#### E. Multi-department ownership baseline

Required:

- extend the subject ownership contract so a subject can be baseline-qualified for more than one department
- preserve a clear primary department if needed, but add explicit additional allowed departments
- flow that contract through:
  - subject reads and writes
  - `Teaching Load`
  - autofill
  - recovery and redistribution endpoints
  - any qualification helper used by `schedule-constructor` or assignment services
- implement the stakeholder-backed example:
  - `STE_ROBOTICS` should support both `SCI` and `TLE`
- keep manual placements authoritative even when they are outside the auto baseline

#### F. Auto staffing and manual workflow clarity

Required:

- ensure auto staffing or auto-fill respects the corrected ownership-distribution model after this pass
- do not let autofill silently reintroduce cross-department leakage or broken family-member distribution
- if a subject has multiple allowed departments, treat any of them as baseline-qualified in auto staffing
- make the resulting ownership-distribution rules explicit in the `Teaching Load` UI
- keep the manual scheduler workflow easy and intuitive:
  - clear why a subject/section can or cannot be auto-assigned
  - clear when a teacher is outside the intended ownership distribution
  - clear when manual assignments are overriding or completing autofill
- stop repeating low-value `Department Baseline` filler copy in the teacher rail
- teacher secondary identity should prioritize specialization, not employee ID
- in the left rail and relevant breakdown rows:
  - replace `ID` prominence with specialization
  - keep department visible, but do not repeat it as the only baseline label
- if UI copy or indicators are touched, keep them scheduler-facing and concise

#### G. Staffing-needs reporting repair

Required:

- the current staffing-needs modal is using stale `auto-fill` preview contract and stale arithmetic
- replace or repair it so it reflects live coverage truth instead of only old auto-fill preview summaries
- do not compute shortage with `unassignedSections * 30` minute math
- use the real subject weekly-minute contract for shortage estimates
- if multiple real shortage subjects exist, the modal must show them honestly
- explicitly ensure `SCI_ES` appears if it remains `0 / 82`
- fix confusing copy such as:
  - `2 sections (1 hours/week)`
  - `~0 additional full-time Science teachers`
- if the system cannot justify a hire estimate honestly, say that redistribution or qualification expansion is needed instead of pretending the numeric estimate is authoritative

#### H. Blocker-classifier repair

Required:

- current recovery classification currently reports zero blocker counts too often
- make the blocker output honestly classify live failures into:
  - true department shortage
  - skewed assignment topology
  - unresolved automation or seed bias
  - rotation-family modeling gap
  - subject-contract gap

### Out Of Scope

Do not:

- reintroduce placeholders
- flatten rotation families back into concurrent weekly load
- redo shell/sidebar or unrelated page UX
- weaken department-first qualification unless there is explicit evidence
- recreate umbrella `TLE`

## Verification Gates

Required:

- server build
- client build if touched
- live Tailnet verification of:
  - coverage summary before and after
  - science family results
  - TLE family-member results
  - multi-department qualification proof for `STE_ROBOTICS`
  - `FIL` load recovery
  - `HG` reconciliation
  - one auto staffing or autofill path after the redistribution fixes
  - one manual staffing path showing the corrected ownership-distribution guidance
  - staffing-needs modal or replacement output
  - blocker-classifier output
- direct proof that per-term family-aware load accounting remains intact

Do not return `GO` from local-only reasoning.

## Required Output

Return:

1. staffing reconciliation changes made
2. files changed
3. science-family results
4. TLE family-member results
5. Filipino redistribution results
6. integrity cleanup results
7. auto staffing behavior after the pass
8. manual workflow and UI communication changes
9. staffing-needs reporting correctness after the pass
10. blocker-classifier correctness after the pass
11. live verification results
12. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- uncovered ownership is materially improved in the real blocker subjects
- stranded `FIL` load is meaningfully reduced where legitimate
- integrity debt is reduced
- multi-department ownership baseline works for the explicitly justified cases
- auto staffing respects the corrected ownership-distribution logic
- the manual workflow communicates the model clearly enough for schedulers to act on it
- staffing-needs reporting is analytically trustworthy and no longer contradicts live coverage
- blocker classification becomes analytically trustworthy
- family-aware load accounting still works after the reconciliation
