Set-Location d:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1 > playwright-p4-output.txt 2>&1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts --workers=1 > playwright-p12-output.txt 2>&1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1 > playwright-p356-output.txt 2>&1
