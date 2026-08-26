# 2026-05-26 - Phase 3 Teaching Load Absolute Coverage + Teacher X One-Shot

## Objective

Close the remaining backend/runtime gap in `Teaching Load` so schedulers have an absolute path to `100%` subject-section coverage when real faculty depth is insufficient.

This pass is not a generic redesign. It is a narrow backend/product-contract fix focused on:

1. explicit `Teacher X` placement as a first-class option in `Teaching Load`
2. auto-fill modes that can intentionally choose between:
   - real-faculty-only saturation up to the hard weekly cap
   - final closure with `Teacher X`
3. staffing/audit truth that reflects those modes honestly
4. generator-readiness parity groundwork, so uncovered subjects are no longer hidden behind vague shortage output

## Why This Pass Is Needed

Current live state proves that `Teaching Load` is healthier than before, but schedulers still do not have an absolute product path to full closure:

- live coverage still shows real gaps in:
  - `SCI_ES`
  - `SCI_CHEM`
  - `TLE_FCS_EXP`
- there is no clean manual path from `Teaching Load` to intentionally place `Teacher X`
- auto-fill does not currently expose a strict operator choice between:
  - real-faculty saturation
  - final synthetic closure
- staffing audit/modal surfaces do not let the operator ask:
  - “show me the real shortage if I do not use Teacher X”
  - “show me the remaining shortage if I do allow Teacher X”

That means the system is still missing the final control surface for absolute coverage.

## Required Outcome

After this pass:

- schedulers can manually assign `Teacher X` from `Teaching Load` where allowed
- auto-fill can run in explicit coverage modes
- shortage/staffing audit can explain those modes clearly in payload truth
- real-faculty saturation can intentionally use the full hard weekly cap of `40h` where policy allows
- the resulting coverage truth is explicit about:
  - real faculty coverage
  - synthetic `Teacher X` coverage
  - unresolved rows after each mode

## Scope

### In Scope

- `Teaching Load` backend/runtime contract
- `Teacher X` availability in manual assignment workflows
- auto-fill mode contract
- staffing report / shortage audit payload contract
- current-year summary truth fields needed by UI

### Out of Scope

- full `Teaching Load` visual redesign
- generator algorithm rewrite
- public/faculty published schedule work
- unrelated EnrollPro outage/runtime work

## Implementation Directives

### 1. Add explicit coverage modes to auto-fill and staffing endpoints

Extend the current teaching-load auto-fill and staffing-report flow so the operator can explicitly choose a coverage strategy.

Add at least these modes:

- `REAL_FACULTY_STANDARD`
  - current safe behavior
  - no synthetic fallback
  - do not force everyone to hard cap

- `REAL_FACULTY_HARD_CAP`
  - fill all eligible real faculty up to the hard cap of `40h/week`
  - do not stop at the old standard threshold if policy allows more
  - this is an intentional operator choice, not the default

- `REAL_FACULTY_THEN_TEACHER_X`
  - first saturate eligible real faculty
  - then close all remaining unresolved pairs with `Teacher X`

The payload must return which mode was used.

### 2. Make `Teacher X` manually assignable from `Teaching Load`

`Teacher X` must become an explicit manual assignment option where synthetic closure is allowed.

Requirements:

- do not hide `Teacher X` behind repair-only logic
- expose it as a selectable assignee for manual placement in `Teaching Load`
- treat it as synthetic coverage, not normal faculty
- preserve existing synthetic tagging and summary truth fields
- do not mix `Teacher X` into the normal real-faculty roster grouping silently

The goal is:
- a scheduler can intentionally choose `Teacher X`
- the system records that choice honestly

### 3. Preserve clear real-vs-synthetic truth in summary and staffing contracts

Do not flatten `Teacher X` into normal staffing success.

The backend contract must continue to distinguish:

- real faculty coverage
- synthetic placeholder coverage
- raw unresolved rows
- unresolved rows after synthetic closure mode

If `Teacher X` closes the final rows, the result must still say so plainly.

### 4. Hard-cap real faculty using credited policy load rules, not weaker display heuristics

The real-faculty saturation mode must use the correct weekly policy contract.

Rules:

- use policy-aware credited load as the operator-facing limit contract
- respect the hard cap at `40h/week`
- do not stop early because of weaker UI heuristics or stale “optimal” thresholds
- continue to honor rotation-family collapse where already implemented in capacity logic

### 5. Add staffing-report parity fields for strategy comparison

The staffing audit / report payload must support side-by-side operator reasoning.

At minimum, return enough truth for the UI to show:

- shortage with real faculty only
- shortage after hard-cap real-faculty saturation
- shortage after `Teacher X` fallback
- how many rows were closed by:
  - real faculty
  - synthetic coverage

This pass is not just about mutation behavior. It is also about decision-quality reporting.

### 6. Keep generator-readiness truth in mind

Do not solve this only at the page level.

The new coverage modes and synthetic closure truth must leave the system ready for later generator/blocker parity work.

Specifically:

- do not lose the distinction between:
  - real qualification shortage
  - synthetic final coverage
- make sure live shortage truth remains machine-readable for later timetabling parity passes

## Verification Requirements

You must not return `GO` without proving all of the following on live Tailnet and/or direct DB/API evidence:

1. Manual `Teacher X` assignment is now possible from `Teaching Load`
   - prove via API contract and UI evidence path

2. Auto-fill supports explicit strategy modes
   - prove payload/contract behavior for:
     - real faculty only
     - hard-cap real faculty
     - real faculty then `Teacher X`

3. Hard-cap mode can actually use eligible real teachers beyond the standard load band
   - do not claim this abstractly
   - show a live or DB-backed example

4. Teacher X fallback can close remaining rows when selected
   - prove unresolved counts before and after

5. Summary/staffing truth still distinguishes real and synthetic coverage honestly

6. Existing degraded/runtime behavior does not regress
   - `Teaching Load` must still work when EnrollPro is down if ATLAS local evidence exists

## Deliverables

1. code changes
2. brief explanation of the new coverage modes
3. live evidence
4. explicit `GO` or `NO-GO`

If any required verification is missing, return `NO-GO`.
