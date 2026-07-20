Set-Location d:\ATLAS\atlas-client
npx tsc --noEmit > ../tsc-output.txt 2>&1
npm run test:ux-guardrails > ../ux-guardrails-output.txt 2>&1
npm run test:timetable-conflict > ../timetable-conflict-output.txt 2>&1
npm run build > ../build-output.txt 2>&1
Set-Location d:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1 > playwright-p4-output.txt 2>&1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts --workers=1 > playwright-p12-output.txt 2>&1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1 > playwright-p356-output.txt 2>&1
