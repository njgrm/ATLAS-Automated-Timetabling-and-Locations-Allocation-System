# Prompt 07 — Simple Timetable Lost-Scheduler Release Proof

## Goal

Prove the full Simple timetable no longer leaves schedulers lost across daily workflows, repair workflows, and failure states.

## Scope

Verification and evidence only, except for concrete bug fixes required to make previously implemented behavior work as intended.

## Required browser task matrix

Run against live Tailnet across desktop, mobile portrait, and mobile landscape:

1. Load `/timetable` in Simple mode.
2. Switch schedule view by Section.
3. Switch schedule view by Teacher.
4. Switch schedule view by Room.
5. Open Help/Tutorial and complete it with keyboard and pointer.
6. Open the publish-blocker/readiness sheet.
7. Route from a blocker group into the correct repair path.
8. Use `Back to blocker summary`.
9. Clear a repair filter.
10. Start placing unresolved sessions.
11. Open Find session.
12. Review a blocked item.
13. Select a visible class on the grid.
14. Open selected-class details.
15. Open selected-class More actions.
16. Open swap review.
17. Open draft planning from Simple mode.
18. Open teacher-leaving/reassign load from Simple mode.
19. Open status key.
20. Toggle Show full day where hidden-row fixture data exists.
21. Export workbook where a generated run exists.
22. Trigger or simulate a disabled publish state and verify visible reason.
23. Trigger or simulate a failed export/generate/publish response and verify plain next-step guidance.
24. Return to Simple mode after any Advanced-view check without losing selected schedule context.

## Required technical assertions

- No global browser scrollbar.
- No horizontal page overflow.
- No visible text overlap.
- More trigger remains inside the viewport.
- One visible lifecycle action exists on mobile.
- No raw enum names are visible in Simple scheduler paths.
- No raw ID-only labels are visible in Simple scheduler paths.
- No compact `G7/G8/G9/G10` grade labels are visible where `GR7/GR8/GR9/GR10` is required.
- Every disabled action tested shows a visible reason.
- Every tested failure state gives a next step.
- Every repair destination has a way back or a way to clear context.
- Tutorial does not auto-open.
- Advanced mode remains optional for Simple workflow understanding.

## Required local gates

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

## Required Playwright gates

```bash
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Evidence log

Append a verification entry to:

- `docs/verification/evidence-log.md`

The entry must include:

- date/time;
- run ID and school year tested;
- viewport list;
- command results;
- artifact paths;
- remaining caveats;
- final `GO` / `NO-GO`.

## Acceptance criteria

- All local gates pass.
- All relevant Playwright gates pass or skip only with explicit fixture-unavailable classification.
- No product failure is hidden as a proxy limitation.
- The release proof demonstrates that every Simple timetable feature either completes, explains itself, or gives a safe next step.

## Report requirements

Return:

- final `GO` / `NO-GO`;
- task matrix result table;
- command result table;
- screenshots/artifact paths;
- concrete remaining caveats;
- whether the timetable can remain release-candidate after this pass.
