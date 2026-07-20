Set-Location d:\ATLAS\atlas-client
npx tsc --noEmit > ../p6-tsc.log 2>&1
npm run test:ux-guardrails > ../p6-ux.log 2>&1
npm run test:timetable-conflict > ../p6-conflict.log 2>&1
npm run build > ../p6-build.log 2>&1
Set-Location d:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1 > p6-test.log 2>&1
