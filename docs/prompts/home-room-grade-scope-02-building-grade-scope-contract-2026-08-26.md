# Home-Room Grade Scope Prompt 02 - Building Grade Scope Contract

## Role

You are the ATLAS full-stack executor for the building grade-scope contract. Implement only the persisted building grade-scope model, API contract, and map editor controls. Do not implement homeroom auto-assignment yet.

## Required preflight

Before editing:

1. Read Prompt 01 final report.
2. Re-run `git --no-optional-locks status --short`.
3. Inspect current `Building` schema, map routes, map service, and map UI.
4. Identify blockers that would prevent a safe persisted grade-scope contract.
5. If blockers exist, record `NO-GO` with exact evidence. Continue only if the blocker does not invalidate the persisted grade-scope contract.

## Problem

Operators need to mark an added or edited teaching building as available for all grades or confined to one or more grade levels. This reflects stakeholder campus layouts where a building can be grade-specific, and future auto-assignment must respect that distinction.

## Target files

- `prisma/schema.prisma`
- Add Prisma migration under `prisma/migrations/...`
- `atlas-server/src/routes/map.router.ts`
- `atlas-server/src/services/map.service.ts`
- Add or update focused server tests for map building grade scope
- `atlas-client/src/types.ts`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- Any local map types/helpers used by those components
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Contract

Add a persisted nullable/int-array building field for grade scope.

Recommended model:

- Field name: `gradeScope`
- Type: `Int[]`
- Default: `[]`
- Meaning:
  - `[]` means any grade can use rooms in this building.
  - `[7]` means Grade 7 only.
  - `[7, 8]` means Grade 7 or Grade 8.

If the repo has an established naming convention that makes `allowedGradeLevels` clearly better, use that consistently instead, but do not create both.

## Functional requirements

- When a building is created, the system shall persist the submitted grade scope.
- When a building is created without grade scope, the system shall persist an empty grade scope.
- When a building is updated, the system shall persist the submitted grade scope.
- When a building is returned by map APIs, the system shall include the grade scope.
- If a submitted grade scope contains a value outside `7`, `8`, `9`, or `10`, then the system shall reject the request with `400`.
- If a submitted grade scope contains duplicates, then the system shall normalize it to unique sorted values.
- If a building is non-teaching, then the system shall allow grade scope to remain empty and shall not use grade scope to make rooms teaching spaces.
- The system shall not infer grade scope from building name.
- The system shall not infer grade scope from color, short code, or room zone.

## UI requirements

- Add an editing control in building add/edit surfaces for:
  - `Any grade`
  - `Grade 7`
  - `Grade 8`
  - `Grade 9`
  - `Grade 10`
- Use existing `@/ui/*` primitives.
- Do not use native `<select>`.
- Do not use raw styled `<button>` when a shared button primitive exists.
- Display a compact grade-scope summary in the building panel.
- Preserve existing `isTeachingBuilding` behavior and room cascade behavior.
- Keep no-scroll architecture intact.
- Use strict DepEd grade colors only where grade meaning is encoded:
  - G7 = green
  - G8 = yellow
  - G9 = red
  - G10 = blue

## Verification

Run server checks:

```bash
cd D:\ATLAS\atlas-server
npx prisma migrate status
npx tsc --noEmit
npm run build
```

Run client checks:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Add focused tests if the repo has a suitable test pattern. The tests must prove:

- Create building with empty scope.
- Create building with `[7]`.
- Update building from empty scope to `[8, 9]`.
- Reject invalid grade scope.
- Normalize duplicate/unsorted grade values.

## Tailnet proof

Using Admin auth, prove:

1. Create or update a disposable building with a grade scope.
2. Re-read `GET /api/v1/map/schools/:schoolId/buildings`.
3. Confirm the grade scope is present.
4. Clean up any disposable building if one was created.
5. Confirm no unrelated map data was changed.

If Tailnet write proof is unsafe, use a local disposable record and mark Tailnet write proof `NO-GO`, not GO. Continue to Prompt 03 if the local/schema/API contract is otherwise proven.

## Acceptance criteria

- Building grade scope is persisted.
- Map API returns grade scope.
- Map UI can edit grade scope.
- Existing map behavior remains intact.
- Prompt 03 can consume the grade-scope field without guessing from building names.

## Per-prompt evidence required

Record this prompt's evidence for the final sequence handoff. Include the exact final field name and response shape. Continue to Prompt 03 after command gates finish unless the schema/API contract is unusable.
