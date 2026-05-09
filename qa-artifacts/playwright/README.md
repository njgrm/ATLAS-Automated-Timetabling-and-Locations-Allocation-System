# Playwright Visual Regression (Role x Viewport)

## What this covers
- Role matrix: `guest`, `faculty`, `admin`
- Viewport matrix:
  - `desktop` (1366x768)
  - `mobile-portrait` (390x844)
  - `mobile-landscape` (844x390)

## Commands
- Install browser:
  - `npm run test:visual:install`
- Run matrix:
  - `npm run test:visual`
- Run CI-safe guest capture mode:
  - `PLAYWRIGHT_TARGET_ROLES=guest npm run test:visual:ci`
- Run snapshot assertions:
  - `PLAYWRIGHT_ASSERT_SNAPSHOTS=1 npm run test:visual:assert`
- Refresh snapshot baselines:
  - `PLAYWRIGHT_ASSERT_SNAPSHOTS=1 npm run test:visual:update`

## Optional Environment Variables
- `PLAYWRIGHT_BASE_URL` (default: `http://127.0.0.1:5174`)
- `PLAYWRIGHT_TARGET_ROLES` (default: `guest,faculty,admin`)
- `PLAYWRIGHT_ASSERT_SNAPSHOTS` (`1` enables `toHaveScreenshot` assertions)
- `PLAYWRIGHT_FACULTY_EMAIL`
- `PLAYWRIGHT_FACULTY_PASSWORD`
- `PLAYWRIGHT_ADMIN_EMAIL`
- `PLAYWRIGHT_ADMIN_PASSWORD`

## Output
- Report: `qa-artifacts/playwright/report/`
- Test output: `qa-artifacts/playwright/results/`
- Screenshots: `qa-artifacts/screenshots/visual-regression/`

## Screenshot Naming
- `YYYYMMDD-role-route-viewport-baseline.png`
- Example: `20260509-faculty-my-mobile-portrait-baseline.png`

## Snapshot Baselines
- Assertion snapshots are stored at:
  - `qa-artifacts/playwright/snapshots/`
- Snapshot assertion names follow:
  - `role-route-viewport.png`
