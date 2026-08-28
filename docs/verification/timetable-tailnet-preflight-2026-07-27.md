# Timetable Tailnet Preflight - 2026-07-27

## Purpose

Use this preflight before running timetable browser QA against `https://njgrm.buru-degree.ts.net`.

The Tailnet hostname depends on the local ATLAS runtime. A stopped local client or server can present as a `502 Bad Gateway` from Tailnet, which is not the same as a timetable product regression.

## Required Checks

Run this before the timetable Playwright matrix:

```powershell
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts --project=desktop --workers=1
```

The preflight verifies:

- local client: `http://127.0.0.1:5174`;
- local API health: `http://127.0.0.1:5001/api/v1/health`;
- Tailnet API health: `https://njgrm.buru-degree.ts.net/api/v1/health`.

## Failure Classification

| Symptom | Classification | Action |
|---|---|---|
| Local client fails before Tailnet health passes | Runtime preflight failure | Start `npm run dev` from `D:\ATLAS`, then rerun preflight. |
| Local API health fails before Tailnet health passes | Runtime preflight failure | Start or inspect the ATLAS server process, then rerun preflight. |
| Tailnet health returns `502` while local checks fail | Runtime preflight failure | Do not mark timetable `NO-GO`; restore local runtime first. |
| Tailnet health fails while local checks pass | Connectivity/Tailnet routing failure | Retry once, then capture Tailnet/network evidence separately from product QA. |
| App console exception after all health checks pass | Product failure | Debug the route or component that emitted the exception. |
| Non-fatal lazy chunk `ERR_ABORTED` with visible UI and passing assertions | Network noise | Record it, but do not block unless it prevents user-visible workflow completion. |

## Final Matrix Placement

The final timetable closure matrix shall run in this order:

1. Tailnet preflight spec.
2. Static client gates.
3. Simple/Advanced layout specs.
4. Workflow specs.
5. Performance spec.

