# Home-Room Grade Scope Prompt 07 - Generation Fallback Grade-Scope Fix

## Role

You are the ATLAS executor assigned to close the remaining grade-scope generation defect after homeroom auto-assignment was proven live.

This is a focused backend/runtime fix. Do not add new UI scope unless source inspection proves the UI needs a small display update for the changed contract.

## Current QA Finding

Tailnet run `439` was generated after the live buildings were configured as:

- `Grade 7 Academic Wing` -> `gradeScope=[7]`
- `Grade 8 Academic Wing` -> `gradeScope=[8]`
- `Grade 9 Academic Wing` -> `gradeScope=[9]`
- `Grade 10 Academic Wing` -> `gradeScope=[10]`
- Other buildings -> `gradeScope=[]` meaning any grade

Homeroom auto-assign is working:

- `20/20` sections have homerooms.
- Auto-assign preview returned `20 assigned`, `0 skipped`.
- Auto-assign apply returned `20 applied`, all `GRADE_SCOPE_MATCH`.

But fresh generation run `439` still produced:

- `HOME_ROOM_UNAVAILABLE=50`
- all 50 had `homeRoomFallbackCause=HOME_ROOM_OCCUPIED`
- all 50 affected sections were Grade 7 sections
- the occupying entries were other grade sections placed with `CROSS_BUILDING_FALLBACK_ASSIGNED` into Grade 7 rooms

Root cause to verify before editing:

The homeroom auto-assign service respects building `gradeScope`, but the generation constructor fallback room candidate path does not appear to enforce `building.gradeScope`. This lets Grade 8/9/10 sessions consume Grade 7 wing classrooms during fallback, displacing Grade 7 sections from their own homerooms.

## Required Preflight

Before editing, run and record:

```powershell
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
```

The repo may already contain staged cleanup from the previous docs/dist commit issue. Do not use `git reset --hard`, `git checkout --`, or any destructive cleanup. Preserve unrelated staged and unstaged work.

Inspect these files before changing code:

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/__tests__/phase2-home-room-strategy.test.ts`
- `atlas-server/src/__tests__/phase3-room-mismatch-semantics.test.ts`
- `atlas-server/src/__tests__/term-scoped-violations.test.ts`
- `prisma/schema.prisma`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

If existing worktree state makes a clean implementation unsafe, continue source investigation and report the blocker exactly. Do not overwrite user or QA changes.

## Required Implementation

### 1. Extend Generator Room Inputs With Building Grade Scope

Ensure the generation constructor has access to each room's building grade scope.

Acceptance requirements:

- Room input data used by `schedule-constructor.ts` shall include `buildingGradeScope: number[]` or an equivalent field.
- `[]` shall mean the room is usable by any grade.
- `[7]`, `[8]`, `[9]`, or `[10]` shall mean the room is usable only by matching section grade for section-level fallback.
- Existing specialized/shared-room behavior shall remain intact unless source investigation proves it also needs grade-scope filtering.

### 2. Enforce Grade Scope In Fallback Room Candidate Selection

In `HOME_ROOM_FIRST` generation:

- The section's own homeroom remains the top candidate when available.
- Same-zone fallback classrooms must respect `buildingGradeScope`.
- Cross-building fallback classrooms must respect `buildingGradeScope`.
- Any-grade buildings with `gradeScope=[]` remain valid fallback candidates.
- A Grade 8/9/10 section must not occupy a Grade 7-only classroom during fallback.
- A Grade 7 section must not occupy a Grade 8/9/10-only classroom during fallback.
- Cohort or modular/shared-facility logic must not be broken; if grade-scope filtering is intentionally not applied to a specific path, document why in code-adjacent comments and tests.

### 3. Preserve Diagnostics

Keep existing diagnostics meaningful:

- `HOME_ROOM_ASSIGNED` when the actual room is the section homeroom.
- `HOME_ROOM_UNAVAILABLE` only when the section's homeroom is unusable and the selected fallback is same-zone but not the homeroom.
- `CROSS_BUILDING_FALLBACK_ASSIGNED` when the selected room is a valid cross-building fallback.
- `homeRoomFallbackCause=HOME_ROOM_OCCUPIED` only when the homeroom is occupied by a valid placement, not by a mismatched-grade fallback that should have been excluded.

If a new skip/fallback diagnostic is needed for grade-scope exhaustion, add it only if tests prove current diagnostics would become misleading.

### 4. Update Runtime Source Map

Update `docs/reference/atlas-runtime-source-of-truth-map.md` with the changed generator contract:

- Building `gradeScope` is used by homeroom auto-assign.
- Building `gradeScope` is also used by generation room fallback selection.
- `[]` remains the any-grade escape hatch.
- Fresh generation proof must distinguish remaining faculty/slot pressure from grade-scope room leakage.

Do not broadly add docs. Keep documentation changes scoped to this file unless a dedicated release proof is created.

## Required Tests

Add or update backend tests that exercise production logic, not copied inline logic.

Minimum cases:

1. A Grade 8 section with a Grade 8 homeroom must not fallback into a Grade 7-only classroom when its homeroom is occupied.
2. A Grade 7 section must not be displaced by a Grade 8/9/10 fallback into a Grade 7-only classroom.
3. A matching grade-scoped fallback room remains eligible.
4. An any-grade fallback room with `gradeScope=[]` remains eligible.
5. Cross-building fallback still works when the target building is same-grade or any-grade.
6. If no grade-compatible room exists, the session should remain unassigned or receive the existing appropriate fallback exhaustion diagnostic instead of using a mismatched-grade room.
7. Existing home-room strategy tests still pass.

Prefer extending `atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` if it already has constructor fixtures for this path. Add a new focused test file only if it keeps the proof cleaner.

## Required Verification Commands

Run all commands below and stop for investigation if any fail:

```powershell
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npx tsx src/__tests__/phase2-home-room-strategy.test.ts
npm run test:home-room-auto-assign
```

Also run any new or modified test file directly with `npx tsx`.

If the change touches shared generation contracts, also run the closest affected generation tests:

```powershell
npx tsx src/__tests__/phase3-room-mismatch-semantics.test.ts
npx tsx src/__tests__/term-scoped-violations.test.ts
```

## Required Live Tailnet Verification

Use Tailnet as the runtime proof target:

```text
https://njgrm.buru-degree.ts.net
```

Login with the existing QA admin credentials. Confirm before generation:

- `/api/v1/runtime/context?schoolId=1&verifyUpstream=false` returns active school year `2`.
- `/api/v1/sections/summary/2?schoolId=1` returns `20` sections and `20` with `homeRoomId`.
- `/api/v1/map/schools/1/buildings` returns grade scopes:
  - Grade 7 Academic Wing `[7]`
  - Grade 8 Academic Wing `[8]`
  - Grade 9 Academic Wing `[9]`
  - Grade 10 Academic Wing `[10]`

Then trigger a fresh generation run:

```http
POST /api/v1/generation/1/2/runs
{
  "ignoreRoomRequestGate": true,
  "enforceShiftWindows": false,
  "roomerStrategy": "HOME_ROOM_FIRST"
}
```

After it completes, fetch:

- `/api/v1/generation/1/2/runs/latest`
- `/api/v1/generation/1/2/runs/{newRunId}/draft`
- `/api/v1/generation/1/2/runs/{newRunId}/violations`

## Required Runtime Proof Queries

From the new run's draft payload, prove all of the following:

1. No placed entry uses a classroom in a building whose non-empty `gradeScope` excludes the entry's section grade.
2. No `CROSS_BUILDING_FALLBACK_ASSIGNED` entry uses a mismatched non-empty building `gradeScope`.
3. `HOME_ROOM_UNAVAILABLE` no longer exists because another grade's cross-building fallback occupied a Grade 7-only room.
4. Remaining `HOME_ROOM_UNAVAILABLE`, if any, must be explained by same-grade or any-grade occupancy.
5. Remaining `UNASSIGNED_SECTION`, if any, must be grouped by reason and clearly separated from grade-scope leakage.

The live proof must include:

- new run id
- assigned count
- unassigned count
- hard violation count
- `roomAssignmentReasonCounts`
- `homeRoomFallbackDiagnostics`
- count of mismatched-grade fallback room placements, expected `0`
- count of mismatched-grade homeroom occupants, expected `0`
- grouped remaining unassigned reasons

## GO / NO-GO Criteria

Report `GO` only if all are true:

- Server typecheck passes.
- Server build passes.
- Required tests pass.
- Fresh Tailnet generation run completes.
- Runtime proof shows `0` mismatched-grade scoped room placements.
- Runtime proof shows `0` Grade 8/9/10 fallback placements occupying Grade 7-only rooms.
- Documentation source map is updated.
- Git status is explained honestly, including any pre-existing staged docs cleanup or uncommitted prior work.

Report `NO-GO` if:

- Any required gate fails.
- The fresh run still has mismatched non-empty building grade-scope placements.
- The proof uses stale run `439` instead of a new post-fix run.
- The implementation only changes auto-assign and does not fix generation fallback.
- The test only copies constructor logic instead of exercising production code.

## Final Report Format

Return:

```markdown
# Final Report - Prompt 07: Generation Fallback Grade-Scope Fix

## 1. GO / NO-GO
[GO or NO-GO]

## 2. Files Changed
[List files and concise purpose]

## 3. Commands Run
[Command -> PASS/FAIL]

## 4. Source-Level Finding
[Where gradeScope is now read and where fallback candidates are filtered]

## 5. Tests Added or Updated
[List test cases and results]

## 6. Tailnet Generation Proof
[New run id, counts, reason counts, mismatch counts]

## 7. Remaining Caveats
[Only real caveats, not hidden blockers]

## 8. Git Hygiene
[Clean/dirty/staged status, and whether generated dist/logs/docs are in scope]
```

Suggested commit:

```text
fix(generation): respect building grade scope during room fallback

- Filter home-room fallback candidates by building grade scope
- Keep any-grade buildings available for fallback
- Prove fresh generation has no mismatched-grade scoped room placements
```
