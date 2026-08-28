# Copilot Execution Prompt: Phase 3 Teaching Load Term-Aware Rotation Model One-Shot

## Objective

Fix the remaining backend truth gap in `Teaching Load` for rotating subjects so weekly load, staffing impact, auto-fill, and hard-cap behavior reflect actual per-term concurrency instead of only same-section family collapse.

This is not a UI redesign pass.
This is not a stale-ownership pass.
This is not a `Teacher X` pass.

It is a focused modeling pass for:

- `SCIENCE` term-aware weekly load truth
- `TLE_ROTATION` term-aware weekly load truth
- staffing-impact accuracy under rotating subjects
- auto-fill / hard-cap accuracy under rotating subjects
- assignment delta fields that the frontend relies on

## Out of Scope

Do not:

- redesign the `Teaching Load` page
- rework `Teacher X` strategy modes
- reopen stale-ownership reconciliation
- explode rotating subjects into separate top-level subject rows
- change the core subject catalog identity model away from umbrella families plus canonical rotating rows

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`

## Live Facts To Treat As Settled

- rotating Science and TLE subjects already carry family-level metadata:
  - `SCI_BIO`, `SCI_CHEM`, `SCI_ES` use `rotationFamily = SCIENCE`
  - exploratory TLE rows use `rotationFamily = TLE_ROTATION`
- rotating Science rows are also tri-sem / term-ordered subjects through canonical subject contract fields such as:
  - `modularGroupId`
  - `modularOrder`
  - `termGroupId`
  - `termCount`
- current load math is not term-aware enough
- current live coverage is:
  - `assignedPairs = 892`
  - `realFacultyAssignedPairs = 892`
  - `unassignedPairs = 70`
  - the only uncovered live subject is `SCI_ES`
- current live auto-fill behavior is:
  - `REAL_FACULTY_STANDARD -> unresolved = 70`
  - `REAL_FACULTY_HARD_CAP -> unresolved = 70`
  - `REAL_FACULTY_THEN_TEACHER_X -> unresolved = 0`, `teacherXRowsClosed = 70`

## Verified Problem

Current rotation load computation in both backend and client helper collapses by:

- `family:${rotationFamily}:${sectionId}`

That means it only removes overlap when the same teacher owns multiple rotating-family rows for the same section.

It does **not** model true per-term concurrency across different sections.

So if a teacher owns:

- Chemistry for one set of sections in one term
- Earth Science for a different set of sections in another term

the current system can still add both sets into one weekly load total, even though those assignments do not exist at the same time.

## Concrete Live Proof

Live Tailnet example on `2026-05-26`:

- `JOSEFINA PASCUAL` (`employeeId=2000055`)
- `sectionTeachingHours = 38.5`
- `rotationFamilyOvercountHours = 0`
- Science ownership includes:
  - `SCI_BIO` on 6 sections
  - `SCI_CHEM` on 2 sections
  - `SCI_ES` on 1 section

Because those Science rows are mostly on different sections, the current model gives no overlap relief even though the Science subjects are term-ranked rotations.

That confirms the user concern is real:

- current weekly load truth is still too section-lane-based
- it is not truly term-aware for rotating families
- this can overstate Science teacher weekly load
- this may also inflate the apparent `SCI_ES` shortage

## Product Outcome

After this pass:

- weekly load for rotating families must reflect actual concurrent term demand
- assigning a rotating subject in a different term must not increase concurrent weekly load unless it increases the teacher's busiest term lane total
- staffing impact must use the same term-aware model
- hard-cap logic must use the same term-aware model
- assignment preview deltas must use the same term-aware model
- if Science shortage remains large after the fix, the system must report that honestly

## Required Implementation

### A. Introduce explicit term-aware rotation crediting

For rotating families such as `SCIENCE` and `TLE_ROTATION`, stop treating family collapse as only:

- same family
- same section

Introduce explicit term-aware load crediting so concurrent weekly load is computed from the teacher's actual per-term rotating-family burden.

Required behavior:

- rotating subjects that belong to the same family but different term ranks must be modeled as mutually exclusive within the same section term flow
- rotating assignments across different sections must contribute to the term bucket they belong to
- the credited weekly load for a rotating family must be based on the highest concurrent term burden, not the raw sum across all term ranks

Example of desired behavior:

- if a teacher owns 8 Chemistry rows in one term and 8 Earth Science rows in a different term, the family should contribute the heavier single-term total, not both term totals added together
- if a teacher owns rotating-family rows that truly stack in the same term bucket, then the load should still rise accordingly

### B. Use real term metadata, not a frontend-only guess

Do not invent term meaning in the UI.

The backend model must explicitly resolve term rank / term bucket for rotating subjects using the persisted subject contract or another authoritative ATLAS-owned mapping.

Use the canonical rotating subject metadata already present in the subject contract where possible.

If any needed field is missing from the current runtime payload, add it explicitly.

### C. Apply the corrected model consistently across all Teaching Load surfaces

The same term-aware truth must be used in:

- assignment summary payload
- selected-teacher load fields
- `rotationFamilyOvercountHours`
- `rotationFamilyLoadDetails`
- staffing-needs report
- auto-fill preview/apply logic
- hard-cap real-faculty mode
- `assignmentConcurrentDeltaMinutesPerWeek`
- `assignmentExpandsConcurrentDemand`

There must not be one term-aware model for display and another for staffing or automation.

### D. Preserve raw rows while fixing concurrent truth

Do not remove raw visibility.

The contract must continue to distinguish:

- raw owned rows
- raw teaching minutes
- credited concurrent weekly minutes
- overcount removed because of term-aware rotation behavior

### E. Expose cleaner term-aware diagnostics for frontend use

Add or normalize backend fields so frontend can explain the truth without guessing.

At minimum, expose enough to tell:

- which rotation family a row belongs to
- which term rank / term bucket it belongs to
- how much raw weekly load the row represents
- how much concurrent weekly load the row actually adds
- whether it expands the teacher's busiest active term bucket

If the existing field names are insufficient or misleading, extend them cleanly rather than overloading UI-only logic.

### F. Re-evaluate live Science shortage after the model fix

After the term-aware model is applied, re-run live checks for:

- `REAL_FACULTY_STANDARD`
- `REAL_FACULTY_HARD_CAP`
- `REAL_FACULTY_THEN_TEACHER_X`

You must determine whether:

- the `SCI_ES` shortage is still truly `70`
- the shortage decreases once term-aware weekly load is credited correctly
- hard-cap mode can now place more real Science rows than before

If the shortage does not materially improve, say so explicitly in the evidence.

## Verification Requirements

You must not stop at build success.

### Required local verification

Run at minimum:

- `npm --prefix atlas-server run build`
- the most relevant assignment/load regression tests
- add or update tests for term-aware rotating-family load math if current suite does not cover this bug

### Required live Tailnet verification

Using the live Tailnet environment, verify:

1. a Science teacher with cross-term rotating-family ownership
2. current load before and after corrected term-aware crediting
3. staffing-needs output in all three coverage modes
4. whether hard-cap gains any real-faculty recovery after the fix
5. whether `Teacher X` is still required for closure after the fix

Use at least one real live teacher example in evidence.

`JOSEFINA PASCUAL (employeeId=2000055)` is a valid known example if still present live.

## Evidence Log Requirements

Append a new entry to `docs/verification/evidence-log.md` titled exactly:

- `# 2026-05-26 - Phase 3 Teaching Load Term-Aware Rotation Model One-Shot`

The entry must include:

- what the old model was doing
- why it was wrong
- what changed in the backend contract
- before/after live load proof for at least one Science teacher
- before/after staffing mode proof
- explicit verdict on whether Science shortage was partly a modeling inflation or still mostly a real staffing gap

## Success Criteria

This pass is only `GO` if all of the following are true:

- rotating Science/TLE load is term-aware, not just same-section-family-aware
- cross-term rotating assignments no longer inflate weekly load incorrectly
- staffing and auto-fill use the corrected model
- hard-cap behavior is re-evaluated against the corrected model
- evidence log contains live proof

If the backend model is corrected but live shortage remains real, that is still a valid `GO` as long as the system is now truthful.
