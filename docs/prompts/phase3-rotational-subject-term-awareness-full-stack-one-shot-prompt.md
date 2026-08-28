# Copilot Execution Prompt: Phase 3 Rotational Subject Term Awareness Full-Stack One-Shot

## Objective

Repair ATLAS so rotational subjects are truly term-aware across both data truth and operator-facing surfaces.

This is a serious product-correctness pass.
Current `Teaching Load` behavior can overstate weekly load by treating rotational subjects too much like they coexist in the same term.
That can distort:

- teacher weekly load
- hard-cap behavior
- staffing shortage reporting
- auto-fill recovery potential
- scheduler trust

This pass must therefore handle both:

1. backend load / staffing / auto-fill truth
2. frontend term visibility across `Subjects`, `Teaching Load`, and `Sections`

Gemini will only do a final UX polish follow-up after this pass.
Do not leave the frontend half-updated and expect a later UX pass to invent missing truth.

## Out of Scope

Do not:

- redesign page layouts from scratch
- reopen stale-ownership cleanup
- remove `Teacher X` modes
- explode rotational subjects into many new top-level subject rows
- convert the whole system into separate primary per-term schedule pages

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-teaching-load-ux-and-live-data-audit-2026-05-25.md`
- `docs/analysis/phase3-teaching-load-post-clarity-readability-audit-2026-05-25.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/routes/subject.router.ts`
- `atlas-server/src/routes/section.router.ts`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/sections/SectionDetailsSheet.tsx`
- any current subject drawer / teaching-load selected-teacher / section detail components that render rotational subject information

## Live Facts To Treat As Settled

- rotational Science rows already exist as canonical subjects:
  - `SCI_BIO`
  - `SCI_CHEM`
  - `SCI_ES`
- rotational exploratory TLE rows already exist as canonical subjects:
  - `TLE_ICT_EXP`
  - `TLE_AFA_EXP`
  - `TLE_FCS_EXP`
- subject contract already carries rotational metadata such as:
  - `rotationFamily`
  - `modularGroupId`
  - `modularOrder`
  - `termGroupId`
  - `termCount`
- current live uncovered subject is still concentrated in `SCI_ES`
- current auto-fill behavior is:
  - `REAL_FACULTY_STANDARD -> unresolved = 70`
  - `REAL_FACULTY_HARD_CAP -> unresolved = 70`
  - `REAL_FACULTY_THEN_TEACHER_X -> unresolved = 0`
- this suggests hard-cap is not gaining recovery, and current load truth may still be too strict for rotational Science

## Verified Product Problem

Current load computation in backend and mirrored frontend helper collapses rotating families by:

- `family:${rotationFamily}:${sectionId}`

That removes overlap only when a teacher owns multiple rotating-family subjects for the same section.

It does **not** model true per-term concurrency across different sections.

This makes the current system behave like:

- Chemistry in one term
- Earth Science in another term
- different sections

still add together into one weekly load total too often.

This is not just a weak UI explanation problem.
It is a load-truth problem.

## Product Outcome

After this pass:

- rotational subject weekly load must be term-aware
- staffing and hard-cap logic must use that same term-aware truth
- auto-fill must use that same term-aware truth
- `Subjects` page must visibly communicate term rank / term order for rotational subjects
- `Teaching Load` must visibly communicate term rank / term order and use corrected term-aware deltas
- `Sections` details must visibly communicate term rank / term order for rotational assigned classes
- schedulers must be able to tell at a glance which rotational subject belongs to:
  - 1st term
  - 2nd term
  - 3rd term

## Required Implementation

### A. Make rotating-family load truly term-aware

For `SCIENCE` and `TLE_ROTATION`, stop using only family-plus-section collapse as the main concurrent weekly truth.

Required behavior:

- resolve a real term bucket / term rank for each rotational subject row
- compute rotating-family credited weekly load from the teacher's actual concurrent per-term burden
- if a teacher owns rotational rows in different terms, they must not all stack into the same weekly concurrent total unless they truly belong to the same term bucket

The intended model is:

- raw rows still exist
- raw weekly minutes still exist
- concurrent weekly credited load for a rotational family is based on actual overlapping term burden

### B. Apply the corrected model consistently

The corrected term-aware truth must drive all of these:

- teacher summary load fields
- `rotationFamilyOvercountHours`
- `rotationFamilyLoadDetails`
- staffing-needs report
- auto-fill preview/apply
- hard-cap mode
- `assignmentConcurrentDeltaMinutesPerWeek`
- `assignmentExpandsConcurrentDemand`

Do not leave one model for summary and another for staffing.

### C. Expose explicit term metadata in payloads

Do not force frontend to infer terms from subject codes.

Expose normalized frontend-safe term awareness for rotational subjects, such as:

- term rank
- readable term label
- term group / rotation group when relevant

At minimum, the frontend must be able to render:

- `1st Term`
- `2nd Term`
- `3rd Term`

for rotational rows without re-implementing business logic.

### D. Update `Subjects` page for term awareness

The `Subjects` page must visibly communicate rotational term order.

Required:

- rotational subjects must clearly show which term they belong to
- this must appear in the main subject identity/detail treatment, not be hidden as a weak secondary implementation detail
- subject drawer/detail view must also show:
  - rotation family
  - term rank
  - readable term label

Do not just show `SCIENCE` or `TLE_ROTATION` and expect schedulers to infer the rest.

### E. Update `Teaching Load` page for term awareness

The `Teaching Load` page must use corrected term-aware load truth and also visibly communicate it.

Required:

- selected-teacher assignment summary must show term rank / term label for rotational subject rows
- assignment-time row data must show whether a rotational row is:
  - same family
  - which term
  - whether it increases concurrent weekly load
- if assigning a different-term rotational subject does not increase concurrent weekly load, the delta must say so honestly
- if it does increase load, the delta must explain why in term-aware language

Do not rely on hover-only explanation for the existence of terms.

### F. Update `Sections` detail surfaces for term awareness

Where `Sections` shows assigned-class details, rotational subjects must also show term awareness.

Required:

- section details drawer/sheet must show term rank / readable term label for rotational assigned classes
- if a section carries multiple rotational-family class rows, the detail surface must make their term sequencing obvious

This is needed because schedulers should be able to inspect a section and understand the term path without jumping back to `Subjects` or `Teaching Load`.

### G. Preserve canonical subject structure

Do not replace canonical subject rows with vague umbrella-only display.

The system still needs canonical rows like:

- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`

But scheduler-facing surfaces must pair that with explicit term meaning.

### H. Re-evaluate live Science shortage after model fix

After the corrected term-aware model lands, re-run live Tailnet checks for:

- `REAL_FACULTY_STANDARD`
- `REAL_FACULTY_HARD_CAP`
- `REAL_FACULTY_THEN_TEACHER_X`

You must determine:

- whether `SCI_ES` shortage is still `70`
- whether hard-cap now recovers more real-faculty rows
- whether `Teacher X` is still required for closure
- whether current Science shortage was partly inflated by wrong term-unaware load crediting

If shortage remains real after the correction, say so explicitly.

## UX / UI Constraints For This Pass

Because this is a full-stack pass, frontend updates are required, but do not let them turn into a redesign.

Required:

- preserve no-scroll page architecture
- use project `@/ui/*` primitives
- do not introduce raw native controls
- do not create giant dashboard cards
- term labels should be visible, compact, and scheduler-readable
- do not solve this with tooltip-only disclosure

The job here is:

- truth first
- visible term awareness second
- layout churn last

## Verification Requirements

You must not stop at build success.

### Required local verification

Run at minimum:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- update or add regression tests for term-aware rotating-family load truth
- update or add tests for payload term metadata if current suite does not cover it

### Required live Tailnet verification

You must verify on Tailnet:

1. at least one Science teacher with cross-term rotating assignments
2. before/after load behavior for that teacher
3. before/after staffing mode behavior
4. visible term labels in:
   - `Subjects`
   - `Teaching Load`
   - `Sections` detail view

Use at least one real teacher example in evidence.

## Evidence Log Requirements

Append a new entry to `docs/verification/evidence-log.md` titled exactly:

- `# 2026-05-26 - Phase 3 Rotational Subject Term Awareness Full-Stack One-Shot`

The entry must include:

- what the old model did
- why it was wrong
- how the backend term-aware model now works
- what frontend surfaces now show
- before/after live load proof
- before/after staffing proof
- explicit verdict on whether Science shortage is still mostly real after the correction

## Success Criteria

This pass is only `GO` if all of the following are true:

- rotating Science/TLE load is term-aware, not just family-plus-section-aware
- staffing and auto-fill use the corrected term-aware truth
- `Subjects` clearly shows term rank for rotational subjects
- `Teaching Load` clearly shows term rank and uses corrected assignment deltas
- `Sections` detail surfaces clearly show term rank for rotational classes
- live evidence proves whether the Science shortage changed or remained real

If the corrected model still leaves a real Science shortage, that is acceptable.
The system just has to be truthful and visibly understandable.
