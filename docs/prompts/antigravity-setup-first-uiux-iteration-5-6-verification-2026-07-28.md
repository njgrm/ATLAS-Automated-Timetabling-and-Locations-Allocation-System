# Antigravity Verification Prompt — Setup-First UI/UX Iterations 5–6

Run an independent browser Playwright verification of ATLAS Setup-First UI/UX Iterations 5–6 against the live Tailnet environment. Do not use localhost.

## Target and login

- URL: `https://njgrm.buru-degree.ts.net`
- Admin login: `1000001` / `AdminSY2026!`
- Viewports: desktop, mobile portrait, and mobile landscape.

## Required local gates

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts --project=desktop --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-5-6.spec.ts --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-0-2.spec.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-3-4.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1
```

## Browser checks

### Campus and rooms (`/map`)

1. Confirm `Room readiness` is visible before `Campus Explorer` in the document and in the first useful viewport.
2. Confirm the list uses text-plus-icon statuses and can show `Ready`, `Needs capacity`, `Needs room type`, `Needs section`, and `Unavailable` without hover.
3. Confirm no map interpretation is required to find a room blocker and `Edit campus map` remains available as the repair action.
4. Confirm map/building surfaces load behind a visible fallback and do not introduce a global scrollbar.
5. Confirm the room list and map use local scrolling only on desktop, mobile portrait, and mobile landscape.

### Dashboard (`/`)

1. Confirm `Setup readiness` is a visible `dashboard-readiness-hub`.
2. Confirm it contains seven plain-language steps: Sections, Subjects, Teachers, Teaching Load, Rooms, Timetable, and Publish readiness.
3. Confirm each step links to the existing repair route: `/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, `/timetable`, `/schedules`.
4. Confirm the source state is visible without hover (`Verified live`, `Checking source`, `Using saved data`, `No saved data`, or `Partial data`).
5. Confirm the first incomplete step is visually obvious and no dashboard control is hidden behind another panel on mobile.

### Regression and quality

- No critical console errors, page errors, or failed ATLAS API requests.
- No global vertical or horizontal overflow on any tested viewport.
- Existing timetable and setup workflows from Iterations 0–4 remain usable.
- Do not accept a pass based only on static grep; interact with the page and capture screenshots or JSON evidence.

## Required report format

Return:

1. `GO` or `NO-GO`.
2. Exact command results and test counts.
3. Browser timing/visibility observations per viewport.
4. Console, page, and network errors (separate fatal from non-fatal Tailnet abort noise).
5. Evidence that room readiness precedes the map and that dashboard links cover all seven domains.
6. Any missed caveats or regressions, with reproduction steps and priority.
7. Whether Iterations 7–8 may proceed.

Do not modify production data or commit live timetable changes during verification.
