# DeepSeek Prompt 02 — Rollover Status vs Runtime Context Alignment

## Role

You are the implementation executor for ATLAS. Codex is acting as QA/reviewer after you finish. Implement only this prompt, then stop and report.

## Context

Authenticated Tailnet probes currently disagree:

- `/api/v1/runtime/context?schoolId=1&verifyUpstream=true` reports:
  - `activeSchoolYearId=3`
  - `activeSchoolYearLabel=2026-2027`
  - `activeYearDrift.status=aligned`
- `/api/v1/runtime/rollover-status?schoolId=1&includeCounts=true` reports:
  - `drift.status=mapping-conflict`
  - `recommendedAction=RESET_DUMMY_YEAR`
  - `SECTION_ID_COLLISION`
  - `canResetDummyYear=true`
  - `publishedResetBlocked=false`

This is a lifecycle blocker. The UI can look aligned while rollover status still tells officers that dummy-year reset is required.

Rollover preview currently reports conflicting SY `3` records:

- `sectionMirrors=20`
- `schedulingPolicies=1`
- `generationRuns=2`
- `manualScheduleEdits=1`
- `lockedSessions=4`
- `lockedSessionActions=18`
- `facultySnapshots=1`
- `sectionSnapshots=1`
- `teachingLoadFacultySubjects=48`
- `teachingLoadOwnerships=265`

## Objective

Make runtime context and rollover status use the same drift truth.

The correct result must be one of:

1. If SY `3` local data truly matches current EnrollPro active year, both endpoints shall report `aligned`.
2. If SY `3` local data truly conflicts with EnrollPro, both endpoints shall report `mapping-conflict` and the UI shall not claim clean alignment.

Do not paper over the contradiction.

## Scope

Likely files:

- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/enrollpro-rollover.service.ts`
- `atlas-server/src/routes/runtime-context.router.ts`
- Runtime/rollover client components only if the API contract is corrected and UI display needs alignment.
- Backend tests for rollover status/context drift truth.

## Required Investigation

Before changing code, inspect:

- How `resolveRuntimeContext` computes `activeYearDrift`.
- How `getRolloverStatus` computes `mapping-conflict`.
- What exactly triggers `SECTION_ID_COLLISION`.
- Whether a previously successful reset/apply leaves allowed current-year records that should not be treated as dummy conflicts.
- Whether `generationRuns`, `manualScheduleEdits`, `lockedSessions`, or Teaching Load ownership rows should affect dummy reset detection after a real reviewed SY `3` setup has already happened.
- Whether the section comparison is comparing stable EnrollPro external IDs or local ATLAS IDs incorrectly.

## Expected Product Semantics

### Aligned state

The system should report `aligned` only when:

- EnrollPro is reachable.
- EnrollPro active year matches ATLAS selected/mirrored active year.
- Existing section/faculty mirrors correspond to current EnrollPro active-year identities.
- No known dummy-year conflict remains.

### Mapping conflict

The system should report `mapping-conflict` when:

- The same numeric school-year ID contains local ATLAS section/faculty data that cannot be reconciled to current EnrollPro active-year identities.
- The system cannot safely sync without explicit reset or migration.

### Current-year reviewed setup data

If officers have already built Teaching Load or generated runs after a successful EnrollPro SY `3` sync, those records should not automatically make the year a dummy conflict. They are expected ATLAS-owned artifacts unless their source snapshot/mirror identity is wrong.

## Acceptance Criteria

- `/api/v1/runtime/context?schoolId=1&verifyUpstream=true` and `/api/v1/runtime/rollover-status?schoolId=1&includeCounts=true` agree on drift status.
- If aligned:
  - both endpoints return `aligned`;
  - UI does not show reset-dummy guidance;
  - rollover status still exposes counts and mirror status.
- If mapping-conflict:
  - both endpoints return `mapping-conflict`;
  - Dashboard and Year setup show reset/migration guidance;
  - generation stays blocked appropriately.
- No destructive reset is executed as part of this prompt unless explicitly approved outside this prompt.
- Backend tests cover:
  - current-year reviewed data does not become dummy conflict by itself;
  - true section identity mismatch returns `mapping-conflict`;
  - runtime context and rollover status agree.

## Required Verification

Run:

```powershell
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Run relevant backend tests if available. If no exact suite exists, add or update focused tests and run them.

Run authenticated Tailnet probes:

```powershell
$login = Invoke-RestMethod -Method Post -Uri 'https://njgrm.buru-degree.ts.net/api/v1/auth/login' -ContentType 'application/json' -Body (@{ identifier='1234501'; password='DepEdSY2026!' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Uri 'https://njgrm.buru-degree.ts.net/api/v1/runtime/context?schoolId=1&verifyUpstream=true' -Headers $headers | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri 'https://njgrm.buru-degree.ts.net/api/v1/runtime/rollover-status?schoolId=1&includeCounts=true' -Headers $headers | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'https://njgrm.buru-degree.ts.net/api/v1/runtime/rollover-sync/preview' -Headers $headers -ContentType 'application/json' -Body (@{ schoolId=1 } | ConvertTo-Json) | ConvertTo-Json -Depth 10
```

If Tailnet has not picked up local backend changes, state that clearly and provide local route proof instead.

## Do Not Do

- Do not run `reset-dummy-year` apply.
- Do not delete generation runs, Teaching Load rows, locks, snapshots, or audit logs.
- Do not change EnrollPro ownership rules.
- Do not make context always trust rollover status without understanding the conflict cause.
- Do not hide mapping conflicts in the UI if they are real.

## Final Report Format

Return:

1. `GO` or `NO-GO`.
2. Root cause of the contradiction.
3. Files changed.
4. Exact before/after endpoint outputs.
5. Test results.
6. Whether Tailnet reflects the fix.
7. Remaining blockers, if any.

