# Home-Room Grade Scope Prompt 05 - Generation Proof and Final QA

## Role

You are the ATLAS release verifier for the full home-room auto-assign and building grade-scope sequence. Verify the entire prompt chain, find failed implementations, and separate setup fixes from remaining dummy Teaching Load feasibility issues.

## Required preflight

Before editing:

1. Read the sequence file.
2. Read Prompt 01 through Prompt 04 final reports.
3. Review the per-prompt evidence log from Prompts 01-04, including any recorded `NO-GO` caveats.
4. Check `git --no-optional-locks status --short`.
5. Inspect all changed files before running tests.
6. If any prior prompt skipped a required Tailnet proof, keep this final QA at `NO-GO` until proof is supplied or explicitly waived by the user.

## Scope

This is the only Codex QA handoff point for the sequence. Verify everything in one shot and identify failed implementations by prompt. Only make fixes if they are small, directly tied to failed acceptance criteria, and can be tested inside this prompt. Do not introduce new features.

## Required source audit

Audit:

- `prisma/schema.prisma`
- latest migration for building grade scope
- `atlas-server/src/routes/map.router.ts`
- `atlas-server/src/services/map.service.ts`
- `atlas-server/src/routes/section.router.ts`
- `atlas-server/src/services/section.service.ts`
- home-room auto-assign service/tests
- `atlas-client/src/pages/Sections.tsx`
- any extracted Sections components
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/types.ts`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Required contract verification

Prove:

- Building grade scope exists in Prisma.
- Migration exists and is scoped only to building grade scope.
- Map create/update accepts valid grade scope.
- Map create/update rejects invalid grade scope.
- Map read returns grade scope.
- Building UI can edit grade scope.
- Auto-assign preview does not write.
- Auto-assign apply writes only after confirmation.
- Auto-assign respects grade-scoped buildings.
- Auto-assign respects any-grade buildings.
- Auto-assign ignores non-teaching buildings and rooms.
- Auto-assign preserves existing home rooms by default.
- Auto-assign reports skipped sections.
- Sections UI gates apply behind preview.
- Manual home-room editing still works.
- Runtime source map was updated if ownership or page dependencies changed.

## Required generation/readiness proof

After homeroom auto-assign has been applied in an approved environment:

1. Re-read section summary.
2. Confirm section home-room assigned count.
3. Run or identify a fresh generation run after the homeroom assignment.
4. Capture latest run summary.
5. Capture latest violations.
6. Compare against the Prompt 01 baseline:
   - assigned entries
   - unassigned entries
   - hard violations
   - soft warnings
   - home-room success rate
   - top hard violation codes
   - top soft warning codes
7. Determine whether remaining hard violations are still caused by:
   - missing homerooms
   - Teaching Load overload
   - policy/shift constraints
   - room inventory/scope constraints
   - actual product bugs

Do not claim final lifecycle readiness unless hard violations reach `0` or the user explicitly accepts dummy-data hard blockers as out of scope for release.

## Required commands

Server:

```bash
cd D:\ATLAS\atlas-server
npx prisma migrate status
npx tsc --noEmit
npm run build
npx tsx src/__tests__/home-room-auto-assign.test.ts
```

Run any focused map/building grade-scope tests added by Prompt 02.

Client:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

If timetable/generation/publish behavior changed:

```bash
cd D:\ATLAS\atlas-client
npm run test:timetable-conflict
```

If notification behavior changed:

```bash
cd D:\ATLAS\atlas-server
npm run test:notifications
```

## Tailnet proof

Using Admin auth:

- `GET /api/v1/health`
- `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`
- `GET /api/v1/runtime/rollover-status?schoolId=1&includeCounts=true`
- `GET /api/v1/map/schools/1/buildings`
- `GET /api/v1/sections/summary/:schoolYearId?schoolId=1`
- `GET /api/v1/sections/home-rooms/:schoolYearId?schoolId=1`
- `POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign` with `mode=preview`
- If approved by the user, `POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign` with `mode=apply`
- `GET /api/v1/generation/1/:schoolYearId/runs/latest`
- `GET /api/v1/generation/1/:schoolYearId/runs/latest/violations`

For browser evidence, verify:

- `/sections`
- `/map`

Viewports:

- `1366x768`
- `390x844`
- `844x390`

## Failure patterns to catch

Mark `NO-GO` if any of these are true:

- The implementation infers grade scope from building names.
- The implementation uses room `buildingZoneId` as the only grade-scope source.
- Preview mutates data.
- Apply overwrites existing homerooms by default.
- Cross-grade fallback is enabled by default.
- A scoped Grade 7 building receives Grade 8-10 sections without explicit fallback.
- Non-teaching buildings or rooms are used.
- Hard violations are relabeled as soft warnings.
- Publish is allowed with hard violations.
- UI uses native form controls where shared primitives exist.
- Tailnet proof is missing for a required live claim.
- `docs/reference/atlas-runtime-source-of-truth-map.md` is stale after ownership/page dependency changes.

## Final report required

Report:

1. `GO` or `NO-GO`.
2. Prompt-by-prompt audit result, including failed or skipped gates from Prompts 01-04.
3. Files changed across the full sequence.
4. Commands run and results.
5. Tailnet endpoint evidence.
6. Browser evidence.
7. Baseline vs final generation comparison.
8. Remaining hard blockers, if any.
9. Remaining soft warnings accepted as dummy-data warnings, if any.
10. Whether lifecycle readiness is now ready through rollover, setup, generation, and publish.

## Suggested commit

```text
test(sections): prove grade-scoped homeroom auto assignment
```
