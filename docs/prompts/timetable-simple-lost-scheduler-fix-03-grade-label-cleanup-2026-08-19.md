# Prompt 03 — Complete Timetable `GR` Grade Label Cleanup

## Goal

Finish the compact grade-label cleanup so timetable-related surfaces use `GR7`, `GR8`, `GR9`, and `GR10`, not `G7`, `G8`, `G9`, or `G10`.

## Verified issue

QA found remaining `G{grade}` labels in timetable-related source after the executor claimed `G7→GR7 everywhere`.

Known matches:

- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
- `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`
- `atlas-client/src/components/timetable/RightPanel.tsx`
- `atlas-client/src/hooks/useTimetableLookupHelpers.ts`
- `atlas-client/src/components/LockPanel.tsx`

The exact search used:

```powershell
rg -n 'G\{[^}]*grade|G\{g\}|`G\$\{|\bG7\b|\bG8\b|\bG9\b|\bG10\b' atlas-client/src/components/timetable atlas-client/src/hooks/useTimetableLookupHelpers.ts atlas-client/src/components/LockPanel.tsx atlas-client/src/components/ManualEditPanel.tsx
```

## Target files

Primary:

- `atlas-client/src/lib/grade-labels.ts`
- `atlas-client/src/lib/deped-glossary.ts`
- `atlas-client/src/hooks/useTimetableLookupHelpers.ts`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
- `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`
- `atlas-client/src/components/timetable/RightPanel.tsx`
- `atlas-client/src/components/LockPanel.tsx`

Tests:

- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`

## Tasks

1. Replace remaining compact `G{grade}` labels with existing helper-backed `GR{grade}` output.
2. Keep long-form `Grade 7` labels where the UI intentionally uses long prose.
3. Do not change DepEd grade color mapping.
4. Do not change internal grade IDs or data normalization.
5. Add or strengthen a source-level guardrail that scans timetable-related source for prohibited compact `G{grade}` label patterns.
6. Add or strengthen rendered Playwright coverage for visible timetable Simple surfaces.
7. If any `G{grade}` occurrence remains intentionally non-visible or test-only, document why in the report and ensure it cannot render to users.

## Acceptance criteria

- No timetable-visible compact grade labels render as `G7`, `G8`, `G9`, or `G10`.
- Source-level guardrails catch future reintroduction of `G{grade}` in timetable display code.
- Rendered Simple timetable tests catch visible `G7/G8/G9/G10` labels.
- No raw internal grade IDs appear as grade labels.
- Existing grade color semantics remain unchanged.

## Verification commands

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
rg -n 'G\{[^}]*grade|G\{g\}|`G\$\{|\bG7\b|\bG8\b|\bG9\b|\bG10\b' src/components/timetable src/hooks/useTimetableLookupHelpers.ts src/components/LockPanel.tsx src/components/ManualEditPanel.tsx
```

The final `rg` may only return documented non-rendered/test-safe matches. If it returns user-visible labels, this prompt is `NO-GO`.

## Report requirements

Return:

- `GO` / `NO-GO`
- before/after list of changed label sites
- final `rg` output
- test result table
- remaining caveats
