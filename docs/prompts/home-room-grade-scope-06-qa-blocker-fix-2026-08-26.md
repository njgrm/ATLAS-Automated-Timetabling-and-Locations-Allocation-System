# Home-Room Grade Scope Prompt 06 - QA Blocker Fix

## Role

You are the ATLAS executor assigned to fix the QA blockers found after `feat(sections): add grade-scoped homeroom auto assignment`.

Do not add new feature scope. Fix only the defects and proof gaps listed here.

## QA verdict to address

Codex QA marked the implementation `NO-GO` for these blockers:

1. Required backend test file is missing.
2. Invalid auto-assign inputs return `200` instead of `400`.
3. Auto-assign reads room capacity but does not enforce or explicitly waive it in behavior.
4. Final generation proof is missing; latest Tailnet run still shows `105` hard `UNASSIGNED_SECTION` violations.
5. Live grade-scope matching is not proven because all buildings still have `gradeScope=[]`.
6. `CHANGELOG.md` and `docs/reference/atlas-runtime-source-of-truth-map.md` were claimed but not committed.
7. Generated `dist` assets and server log files were committed.
8. `BuildingPanel.tsx` and `Sections.tsx` exceed the 1000-line component limit.

## Required preflight

Before editing:

1. Read the sequence and Prompts 01-05.
2. Check current git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
git --no-optional-locks show --name-only --format= HEAD
```

3. Inspect:
   - `atlas-server/src/routes/section.router.ts`
   - `atlas-server/src/services/home-room-auto-assign.service.ts`
   - `atlas-server/src/routes/map.router.ts`
   - `atlas-server/src/services/map.service.ts`
   - `atlas-client/src/components/BuildingPanel.tsx`
   - `atlas-client/src/pages/Sections.tsx`
   - `atlas-client/src/components/sections/HomeRoomAutoAssignDialog.tsx`
   - `prisma/schema.prisma`
   - latest migration under `prisma/migrations/`

If any blocker cannot be fixed safely, report `NO-GO` with exact reason and continue fixing independent blockers where possible.

## Required Fixes

### 1. Remove Generated And Log Artifacts

Remove tracked generated artifacts and logs from the feature commit scope:

- `atlas-client/dist/**`
- `atlas-server/dist/**`
- `atlas-server/server.log`
- `atlas-server/server.err`

Do not delete source files. Do not use destructive git reset commands. Prove the final commit/diff excludes generated assets and logs.

### 2. Add Backend Auto-Assign Tests

Create:

- `atlas-server/src/__tests__/home-room-auto-assign.test.ts`

Tests must exercise production logic, not only string matching.

Required cases:

- Preview does not write.
- Apply writes the same assignments returned by preview.
- Existing home rooms are preserved by default.
- `overwriteExisting=true` can reassign.
- Grade-scoped buildings are preferred over any-grade buildings.
- Cross-grade scoped buildings are blocked by default.
- Cross-grade fallback works only when `allowCrossGradeFallback=true`.
- Empty `gradeScope=[]` buildings work as any-grade fallback.
- Non-teaching buildings are ignored.
- Non-teaching rooms are ignored.
- Duplicate room assignment cannot occur.
- Skipped sections include stable reasons.
- Invalid mode returns `400`.
- Invalid boolean payloads return `400`.
- Invalid `schoolId` and invalid `schoolYearId` return `400`.
- Capacity behavior is tested according to the final capacity decision below.

### 3. Harden Auto-Assign Route Validation

In `atlas-server/src/routes/section.router.ts`, reject invalid request bodies instead of silently coercing:

- `mode` must be omitted, `preview`, or `apply`.
- `overwriteExisting` must be omitted or boolean.
- `allowCrossGradeFallback` must be omitted or boolean.
- `schoolId` must be a positive integer.
- `schoolYearId` path param must be a positive integer.

Invalid payloads must return `400`, not `200`.

### 4. Fix Capacity Handling

Preferred behavior:

- Fetch section `enrolledCount`.
- A room with non-null `capacity` lower than `section.enrolledCount` shall not be assigned.
- If all otherwise eligible rooms are too small, skip with `ROOM_CAPACITY_TOO_SMALL`.
- Rooms with `capacity=null` may be treated as capacity unknown and eligible, but the response should make that explicit if local response conventions support warnings.

If capacity is intentionally not enforced because dummy data capacity is unreliable, make that explicit in:

- service response contract
- backend tests
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- final report

Do not leave `capacity` read but unused.

### 5. Prove Grade-Scope Matching

Tailnet currently has all buildings at `gradeScope=[]`. To prove grade-confinement matching, use a disposable local/test dataset unless the user explicitly approves Tailnet mutation.

Final proof must show:

- Grade 7 sections prefer Grade 7 scoped buildings.
- Grade 8 sections prefer Grade 8 scoped buildings.
- Grade 9 sections prefer Grade 9 scoped buildings.
- Grade 10 sections prefer Grade 10 scoped buildings.
- Cross-grade scoped rooms are skipped unless fallback is enabled.

### 6. Extract Oversized Frontend Files

These files exceed the 1000-line project limit:

- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/pages/Sections.tsx`

Extract logical subcomponents without changing behavior.

Recommended extraction:

- `atlas-client/src/components/campus-map/BuildingGradeScopeControl.tsx`
- `atlas-client/src/components/sections/SectionsHomeRoomActions.tsx`

After extraction, prove both original files are under 1000 lines.

### 7. Commit Documentation Actually Intended For Handoff

If documentation is part of the handoff, force-add intentionally:

- `CHANGELOG.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- this prompt file if needed for audit trail

Do not claim ignored docs are committed unless `git ls-files` or `git show --name-only HEAD` proves it.

### 8. Fresh Generation Proof

After homerooms are assigned in the approved environment:

1. Capture current section home-room count.
2. Trigger or identify a fresh generation run created after homeroom assignment.
3. Capture latest run summary and violations.
4. Compare against baseline run `427`:
   - assigned entries
   - unassigned entries
   - hard violations
   - soft warnings
   - home-room success rate
   - top hard violation codes
   - top soft warning codes

Do not claim hard violations are zero unless the fresh run proves it. If fresh generation is blocked by Tailnet outage, missing permission, or user approval, final report must say `NO-GO for generation proof`.

## Required Commands

Server:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npx tsx src/__tests__/home-room-auto-assign.test.ts
```

Client:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Migration:

```bash
cd D:\ATLAS
npx prisma migrate status
```

Git proof:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks show --name-only --format= HEAD
git --no-optional-locks ls-files CHANGELOG.md docs/reference/atlas-runtime-source-of-truth-map.md
```

## Tailnet Probes

Using Admin auth:

- `GET /api/v1/health`
- `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`
- `GET /api/v1/map/schools/1/buildings`
- `GET /api/v1/sections/summary/:schoolYearId?schoolId=1`
- `POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign` with `mode=preview`
- Invalid request probes:
  - `mode=nonsense` must return `400`
  - `overwriteExisting="yes"` must return `400`
  - `allowCrossGradeFallback="yes"` must return `400`
- `GET /api/v1/generation/1/:schoolYearId/runs/latest`
- `GET /api/v1/generation/1/:schoolYearId/runs/latest/violations`

## Browser QA

Verify `/sections` and `/map` at:

- `1366x768`
- `390x844`
- `844x390`

Acceptance:

- No global page overflow introduced.
- Auto-assign workflow remains preview-first.
- Apply is disabled until preview succeeds.
- Grade-scope control is usable and compact.
- Manual home-room editing still works.
- BuildingPanel and Sections page still use shared UI primitives.

## Final Report Required

Report:

1. `GO` or `NO-GO`.
2. Blocker-by-blocker fix summary.
3. Files changed.
4. Files removed from commit scope.
5. Exact commands run and results.
6. Backend test coverage summary.
7. Tailnet endpoint evidence.
8. Browser QA evidence.
9. Fresh generation comparison against run `427`.
10. Remaining caveats.

## GO Criteria

All must be true:

- No generated `dist` assets or server logs remain in the feature commit.
- Required backend test file exists and passes.
- Invalid auto-assign request bodies return `400`.
- Capacity behavior is implemented or explicitly documented/tested as waived.
- Grade-scope matching is proven with scoped buildings.
- Oversized frontend files are under 1000 lines after extraction.
- Documentation claims match committed files.
- Fresh generation proof is captured, or the final report honestly marks generation proof `NO-GO`.

## Suggested commit

```text
fix(sections): close grade-scoped homeroom auto-assign QA blockers
```
