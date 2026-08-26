# Antigravity Verification Prompt — Setup-First UI/UX Iterations 7–8

Independently verify the final setup-first UX stream on the live Tailnet. Do not use localhost for browser assertions and do not mutate timetable data.

## Target and login

- URL: `https://njgrm.buru-degree.ts.net`
- Admin login: `1000001` / `AdminSY2026!`
- Projects: desktop, mobile portrait, mobile landscape.

## Required gates

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts --project=desktop --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-7-8.spec.ts --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-0-2.spec.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-3-4.spec.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-5-6.spec.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-7-8.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1
```

## Browser requirements

1. Visit `/`, `/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, and `/timetable` after admin login.
2. Wait for usable content, not skeletons, before judging overflow or errors.
3. Confirm no uncaught page errors, no critical console errors, and no 5xx ATLAS API responses.
4. Confirm no global vertical or horizontal scrollbar at any viewport; local content may scroll.
5. Confirm Dashboard mobile-landscape loading and ready states stay inside the shell.
6. Confirm `/timetable` opens in Simple view, Advanced view is reversible, and the grid remains usable.
7. Confirm the seven Dashboard readiness links route to `/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, `/timetable`, and `/schedules`.
8. Confirm the room-readiness list precedes the campus map and status labels are text-plus-icon, not color-only.

## Older-user boundary

Do not claim Product GO from automated tests. Product GO still requires the moderated participant scorecard in `docs/verification/timetable-moderated-older-user-validation-2026-07-27.md`, or an explicit stakeholder decision to defer it.

## Required report

Return `GO` or `NO-GO`, exact command counts, per-viewport timing/overflow/error observations, any regression reproduction steps, and whether the stream is `Technical GO` or `Product GO`.
