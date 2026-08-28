# Copilot Execution Prompt: Phase 3 Faculty Identity Source Reconcile And Assignment-Bearing Linkage One-Shot

## Goal

Repair the faculty identity mapping path so live faculty logins resolve to the correct assignment-bearing `FacultyMirror` record from the current EnrollPro-sourced truth.

This pass is about source-of-truth identity, not cosmetic UI polish.

The immediate problem is that a live SCI teacher can authenticate successfully, but the faculty portal, room-request flow, and teaching-assignment summary surfaces resolve to the wrong duplicate faculty mirror and therefore show empty data.

## Why This Pass Exists

Current live audit on Tailnet found:

- provided `2000060` does not currently resolve to a local ATLAS auth mapping
- active live SCI faculty login `2000056 / DepEd2026!` succeeds
- authenticated account `elpidio.aquino@deped.edu.ph` is linked to:
  - `AtlasAuthAccount.facultyId = 17905`
  - `FacultyMirror.externalId = 4855`
- but live Teaching Load / faculty-assignment summary truth for the same person is on a duplicate mirror:
  - `FacultyMirror.id = 18189`
  - `FacultyMirror.externalId = 4997`
  - `employeeId = 2000056`
  - `subjectCount = 5`
  - `sectionCount = 15`
  - `policyCreditedHours = 31.3`
- current faculty portal route resolves faculty identity using only `facultyMirror.externalId = JWT.userId`
- result: live faculty login works, but `/faculty-portal`, room-request bootstrap, and teaching identity all render as empty even though the real teacher has load

This is a source-linkage bug and a duplicate-mirror reconciliation problem.

## In Scope

- `atlas-server/src/services/local-auth.service.ts`
- `atlas-server/src/routes/faculty-portal.router.ts`
- faculty identity resolution used by:
  - faculty portal
  - room requests
  - faculty-facing assignment identity
- duplicate faculty mirror resolution logic where needed
- focused tests covering:
  - live-style faculty login resolution
  - dashboard identity contract
  - assignment-bearing teacher linkage

## Out Of Scope

- broad faculty UX redesign
- public published schedule UI
- teaching-load page redesign
- timetable generation math
- school-specific hardcoding of `ELPIDIO AQUINO`, `2000056`, `17905`, or `18189`

## Required References

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `atlas-server/src/services/local-auth.service.ts`
- `atlas-server/src/routes/faculty-portal.router.ts`
- `atlas-server/src/services/faculty-portal.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/routes/room-preference.router.ts`
- `atlas-server/src/__tests__/faculty-dashboard-contract.test.ts`
- `atlas-server/src/__tests__/faculty-draft-run-contract.test.ts`
- `atlas-server/src/__tests__/preference-wellbeing.test.ts`

## Required Findings To Respect

1. Do not assume the currently authenticated faculty mirror is canonical just because login succeeded.
2. Do not assume name equality alone is sufficient for duplicate resolution.
3. Prefer authoritative source-linked identity signals in this order where available:
   - EnrollPro teacher/faculty external ID
   - explicit employee ID linkage
   - existing assignment-bearing mirror linkage if multiple mirrors represent the same faculty identity
4. The fix must stay school-agnostic and deterministic.

## Required Changes

### 1. Repair canonical faculty identity resolution

Implement a canonical resolution path for faculty auth linkage so that when duplicate `FacultyMirror` rows exist for the same faculty identity:

- the assignment-bearing, source-consistent mirror is selected
- stale or non-canonical duplicates do not silently win just because they were linked earlier

This must work without hardcoding a specific teacher.

### 2. Repair faculty portal identity lookup

Current `faculty-portal` route must not rely on a brittle single-field lookup if a better canonical identity is already known through local-auth linkage or source-backed matching.

After this pass:

- the logged-in faculty user must resolve to the same mirror that owns their actual current teaching-load truth
- `teachingAssignments` must no longer be empty when real current-year assignments exist for that teacher

### 3. Keep room-request ownership aligned with the same faculty identity

The faculty room-request bootstrap and any faculty-owned request routes must stay aligned with the same canonical faculty mirror used by the faculty portal.

Do not let:

- dashboard
- room requests
- faculty assignment identity

resolve against different duplicate mirrors for the same person.

### 4. Tighten duplicate-mirror handling safely

If duplicate mirrors are detected for a faculty identity:

- prefer deterministic reconciliation over silent ambiguity
- append evidence about the duplicate condition and the resolution rule used
- do not delete data blindly in this pass unless it is explicitly safe and required

### 5. Update the faculty regression harness

Current faculty tests are partially stale and too forgiving.

Fix them so that:

- they use current valid faculty auth assumptions
- they do not depend on outdated demo-account assumptions when a better source-derived faculty account is available
- they fail hard on login failure instead of returning early and masking the real regression

## Verification Requirements

### Automated

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-server run test:faculty-dashboard-contract`
- `npm --prefix atlas-server run test:faculty-draft-run-contract`
- `npm --prefix atlas-server run test:preference-wellbeing`

If one of these tests needs legitimate fixture or auth-contract adjustment, fix it in this pass rather than waiving it.

### Tailnet Runtime Verification

Use the live Tailnet environment.

At minimum verify:

1. faculty login with the current source-valid SCI faculty account succeeds
2. resolved faculty portal identity points to the assignment-bearing mirror
3. `/faculty-portal/:schoolId/:schoolYearId/dashboard` returns non-empty `teachingAssignments` when live teaching-load truth exists
4. room-request latest bootstrap uses the same faculty identity linkage
5. if the active draft truly has no plotted entries for that teacher, report that honestly in evidence rather than masking it

### Evidence

Append only to `docs/verification/evidence-log.md`.

Include:

- the duplicate faculty mirror condition found
- the canonical resolution rule implemented
- touched files
- automated results
- live faculty login used for verification
- before/after faculty mirror resolution summary
- whether `teachingAssignments` became non-empty
- GO / NO-GO verdict

## GO / NO-GO

### GO only if

- live faculty login resolves to the correct assignment-bearing mirror
- faculty portal identity and room-request identity are aligned
- faculty regression tests no longer hide auth failures

### NO-GO if

- duplicate faculty mirrors still cause empty faculty portal data for an assignment-bearing teacher
- tests still silently short-circuit on missing token
- the fix depends on teacher-specific hardcoding
