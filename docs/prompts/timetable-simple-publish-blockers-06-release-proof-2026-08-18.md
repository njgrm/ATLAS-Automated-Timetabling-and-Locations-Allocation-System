# Prompt 06 — Simple Publish Blocker Release Proof

## Goal

Prove that Simple mode now handles publish blockers clearly without regressing core timetable functions.

## Scope

Verification only unless a concrete failure is found. Fix only concrete failures.

## Required checks

Run local gates:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Run Playwright gates:

```bash
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Browser scenarios

Verify across desktop, mobile portrait, and mobile landscape:

1. Load `/timetable` in Simple mode.
2. Confirm Simple mode is default.
3. Confirm blocked publish state is visible when blockers exist.
4. Open the Simple publish readiness sheet.
5. Confirm exact unresolved and hard blocker counts.
6. Confirm blocker groups are by real cause.
7. Confirm warning groups are secondary.
8. Confirm no raw ID-only messages appear.
9. Open Teaching Load from a teacher-load blocker.
10. Return to Timetable.
11. Open manual placement from a no-slot blocker.
12. Confirm generated placement still opens review before save.
13. Confirm generated swap still opens modern swap review.
14. Confirm draft planning remains reachable.
15. Confirm Advanced diagnostics remain reachable but are not required.

## UX readiness criteria

- Simple mode answers `Why can't I publish?` within one interaction.
- Simple mode answers `What should I fix first?` without reading a diagnostics wall.
- Simple mode uses plain language.
- Touch targets remain practical at mobile widths.
- No global browser scrollbar is introduced.
- No horizontal overflow is introduced.
- No text overlaps.
- Color is not the only state indicator.
- Disabled actions explain why beside or near the control.

## Evidence log

Append results to:

- `docs/verification/evidence-log.md`

Include:

- run ID
- counts
- screenshot/artifact paths
- command results
- remaining caveats
- final `GO` / `NO-GO`

## Acceptance criteria

- All required commands pass.
- All write-sensitive workflows are either read-only, preview-only, or cleanly reverted.
- Product failures are not hidden as fixture unavailability.
- The final report states whether the Simple-mode publish blocker UX is release-ready.

## Suggested commit

```text
fix(timetable): prove simple publish blocker recovery

Verify Simple-mode blocker explanations, repair routing, and timetable regressions across supported viewports.
```
