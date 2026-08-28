# Copilot Execution Prompt: Phase 3 Rotational Subject Peak-Term Capacity Correction One-Shot

## Objective

Correct the remaining rotational-subject load bug in ATLAS so `SCIENCE` and `TLE_ROTATION` weekly load, staffing, hard-cap behavior, and auto-fill follow the true school rule:

- year-round subjects stack normally
- rotational families are strictly sequential by term
- credited weekly rotational load is the **heaviest single term**, not the sum of all terms

This is the correction pass after the earlier term-awareness implementation exposed term metadata but still summed term buckets into one credited weekly load.

## Authoritative Rule From Stakeholder Clarification

Treat this as settled product truth:

1. `SCIENCE` and `TLE_ROTATION` must credit only the **peak single term** load for that rotation family.
2. `Term 1`, `Term 2`, and `Term 3` are strictly sequential and mutually exclusive for load credit.
3. Rotational-family peak-term load **must still stack normally** with year-round subjects.
4. Real-faculty recovery must exhaust corrected term-aware capacity first.
5. `Teacher X` must only fill rows that remain unresolved after per-term human capacity is exhausted.
6. Official UI terminology is exactly:
   - `Term 1`
   - `Term 2`
   - `Term 3`

## Out of Scope

Do not:

- redesign page layouts
- reopen stale-ownership or source-honesty work
- change the canonical subject catalog into different top-level term-specific resources
- alter non-rotational load behavior

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
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/routes/section.router.ts`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/sections/SectionDetailsSheet.tsx`
- `ATLAS-PUBLIC-API.md`
- `api/ATLAS-PUBLIC-API.md`
- `api/ATLAS-LIVE-TEACHING-LOAD-INTEGRATION.md`
- `api/ATLAS-SECTION-FIRST-TEACHING-LOAD-ENDPOINTS.md`

## Verified Current Bug

The prior pass introduced term buckets and term labels, but the credited load is still wrong because rotational-family credited minutes are still effectively computed as:

- `sum(all rotational term buckets)`

instead of:

- `max(rotational term buckets)`

This still creates phantom weekly overload for cross-term rotational ownership.

## Required Behavior

### A. Fix rotational-family credited load

For each rotational family such as `SCIENCE` and `TLE_ROTATION`:

- compute raw minutes across all owned rotational rows
- compute per-term concurrent minutes for:
  - `Term 1`
  - `Term 2`
  - `Term 3`
- set credited rotational-family weekly load to the **largest single term total**

Do not sum `Term 1 + Term 2 + Term 3`.

### B. Preserve year-round stacking

The total weekly credited load for a teacher must be:

- `all year-round subjects`
- plus `peak rotational Science term`
- plus `peak rotational TLE term`
- plus advisory / ancillary credits as already defined by policy

Do not collapse year-round subjects into the rotational rule.

### C. Apply this rule consistently

The corrected peak-term rule must be used in:

- selected-teacher load fields
- summary load fields
- `rotationFamilyOvercountHours`
- `rotationFamilyLoadDetails`
- assignment row delta fields
- staffing-needs
- real-faculty standard mode
- hard-cap mode
- auto-fill preview/apply
- `Teacher X` fallback decision

There must not be one rule for display and another for staffing.

### C1. Add explicit per-term teacher breakdown contract

The system now also needs a first-class per-term breakdown for teachers who own rotational subjects.

Required backend outcome:

- teacher detail payloads must expose a clear per-term breakdown showing how rotational subjects line up in:
  - `Term 1`
  - `Term 2`
  - `Term 3`
- the payload must be usable by:
  - `Teaching Load`
  - sister systems
  - future faculty / section detail surfaces

At minimum, expose enough for each teacher to answer:

- which rotational subjects they teach in each term
- which sections belong to each term bucket
- raw minutes for each term bucket
- credited weekly rotational load for each term bucket
- which term is the peak term used for the main weekly load bar

This may be implemented by extending existing teacher assignment endpoints or by adding a dedicated read endpoint, but the contract must be stable and documented.

### C2. Add section-first and teacher-first term-aware API support

Sister systems need direct access to the term-aware rotational information.

Required outcome:

- teacher-first live teaching-load reads must include term-aware rotational breakdowns
- section-first assigned-class reads must include term-aware rotational metadata for rotational classes

Required behavior:

- `GET /faculty-assignments/:facultyId?schoolYearId=<id>` must expose teacher per-term rotational alignment clearly
- `GET /sections/:sectionId/assigned-classes?schoolYearId=<id>` must expose term-aware rotational metadata for assigned classes
- `GET /sections/assigned-classes?schoolId=<id>&schoolYearId=<id>` must expose the same term-aware rotational metadata at schoolwide index level

If you introduce a new endpoint because the current teacher detail route is too overloaded, document and verify it. Do not leave the sister-system contract implicit.

### D. Fix hard-cap recovery behavior

Hard-cap logic must now check capacity **per term** for rotating families.

Required behavior:

- if a teacher is at hard cap in `Term 1`, stop assigning more `Term 1` rotational rows
- if that same teacher still has room in `Term 3`, allow `Term 3` rotational assignments
- if corrected per-term capacity frees additional real-faculty recovery, hard-cap mode must use it

### E. Fix staffing and shortage truth

Staffing shortage for rotational families must be based on unresolved demand after corrected per-term capacity is applied.

You must determine whether current `SCI_ES` shortage remains mostly real after the fix or shrinks meaningfully.

### F. Keep current subject-side term metadata unless blocked

Do not add a DB migration unless truly required.

Use the existing subject contract where possible:

- `rotationFamily`
- `modularOrder`
- `termGroupId`
- `termCount`

If these are enough, keep the fix at service/payload level.

If you discover a true persistence gap that cannot be solved from the current subject contract, document it explicitly before proposing schema change.

## Frontend Requirements In This Same Pass

Because this pass owns both truth and operational visibility, update the affected frontend surfaces too.

Required:

- `Subjects` must visibly use `Term 1 / Term 2 / Term 3`
- `Teaching Load` must visibly use `Term 1 / Term 2 / Term 3`
- `Sections` detail surfaces must visibly use `Term 1 / Term 2 / Term 3`
- auto-fill / staffing modal summaries must visibly use `Term 1 / Term 2 / Term 3` where rotational shortage/capacity is discussed
- teachers with rotational ownership must have a readable per-term breakdown in `Teaching Load`

Do not leave the frontend using `1st Term` / `2nd Term` / `3rd Term`.

Required frontend behavior for per-term breakdown:

- in the selected-teacher surface, schedulers must be able to see how that teacher's rotational subjects are distributed across:
  - `Term 1`
  - `Term 2`
  - `Term 3`
- this should make the peak-term logic understandable without forcing the scheduler to infer it from raw assignment rows
- the term breakdown should stay compact and not destroy the current no-scroll workspace

## Documentation Requirements

Update the API and integration docs in the same pass.

Required files:

- `ATLAS-PUBLIC-API.md`
- `api/ATLAS-PUBLIC-API.md`
- `api/ATLAS-LIVE-TEACHING-LOAD-INTEGRATION.md`
- `api/ATLAS-SECTION-FIRST-TEACHING-LOAD-ENDPOINTS.md`

Required documentation outcome:

- document the per-term rotational fields now available on teacher teaching-load reads
- document the per-term rotational fields now available on section-first assigned-class reads
- clearly distinguish:
  - raw rotational ownership
  - per-term bucket alignment
  - peak-term credited weekly load
- provide at least one concise example payload shape for:
  - teacher-first term-aware teaching-load read
  - section-first term-aware assigned-classes read

## Verification Requirements

You must not stop at build success.

### Required local verification

Run at minimum:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- update or add regression tests for:
  - peak-term rotational-family crediting
  - year-round plus peak-term stacking
  - hard-cap per-term behavior
  - teacher per-term breakdown contract
  - section-first term-aware rotational metadata contract

### Required live Tailnet verification

Verify on Tailnet:

1. at least one Science teacher with cross-term rotational assignments
2. before/after teacher load comparison
3. before/after `REAL_FACULTY_STANDARD`
4. before/after `REAL_FACULTY_HARD_CAP`
5. before/after `REAL_FACULTY_THEN_TEACHER_X`
6. visible `Term 1 / Term 2 / Term 3` labels in:
   - `Subjects`
   - `Teaching Load`
   - `Sections` detail view
7. teacher per-term breakdown is visible and matches backend truth
8. teacher-first API read exposes the per-term rotational breakdown
9. section-first assigned-classes read exposes the per-term rotational metadata

## Evidence Log Requirements

Append a new entry to `docs/verification/evidence-log.md` titled exactly:

- `# 2026-05-26 - Phase 3 Rotational Subject Peak-Term Capacity Correction One-Shot`

The entry must include:

- the prior incorrect rule
- the corrected rule
- whether DB/schema changes were needed or not
- before/after load proof on at least one real teacher
- before/after staffing mode proof
- explicit verdict on whether Science shortage materially changed
- confirmation of which API docs were updated
- confirmation of which teacher-first / section-first endpoints now expose per-term rotational data

## Success Criteria

This pass is only `GO` if all of the following are true:

- rotational-family credited weekly load uses the heaviest single term, not summed terms
- year-round subjects still stack normally
- staffing and auto-fill use the corrected peak-term model
- hard-cap uses per-term rotational capacity correctly
- `Teacher X` remains strictly fallback-only after corrected human capacity is exhausted
- frontend uses exact `Term 1 / Term 2 / Term 3` terminology across the required surfaces
- `Teaching Load` shows a readable per-term teacher breakdown for rotational ownership
- sister-system-facing teacher-first and section-first live endpoints expose per-term rotational alignment
- the required API docs are updated in the same pass
- evidence log proves whether the Science shortage remained real or was partly modeling inflation
