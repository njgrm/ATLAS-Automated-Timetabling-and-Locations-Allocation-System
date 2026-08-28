# Antigravity Independent Prompt — Older-User Session Validation

Independently audit ATLAS against the shared protocol in `older-user-session-validation-shared-protocol-2026-07-28.md`. Use Browser Playwright against the live Tailnet, not localhost, and do not mutate timetable data.

## Target and credentials

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001` / `AdminSY2026!`

## Required commands

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts --project=desktop --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-7-8.spec.ts --workers=1
```

## Browser interaction requirements

- Test desktop, mobile portrait, and mobile landscape.
- Execute T01–T12 as realistic click/tap journeys; do not pass by inspecting DOM text alone.
- For placement and swap, stop at review and cancel. Do not save or commit live timetable changes.
- Capture screenshots or JSON evidence for first action, room readiness, grid labels, placement review, swap review, Simple/Advanced toggle, and cancel recovery.
- Record console errors, page errors, API failures, global overflow, local overflow, focus movement, target dimensions, and visible labels.
- Verify the modern swap review appears and no obsolete teacher/room assignment flow returns.
- Verify click/tap alternatives work without requiring drag.
- Use the click-path audit format to identify handlers whose later calls undo earlier state changes.

## Required report

Write `timetable-older-user-session-validation-ag-2026-07-28.md` and return:

1. `Product GO`, `GO WITH FIXES`, or `NO-GO`.
2. T01–T12 results and timings by viewport.
3. Capability-parity result against the former cockpit.
4. Accessibility findings and exact reproduction steps.
5. Console/network/overflow evidence, separating Tailnet noise from app failures.
6. Findings using `OUSER-NNN` IDs with severity and recommended fixes.
7. Whether Codex should implement fixes before product closure.

Do not claim real participant evidence unless actual representative users were observed. If only browser proxy evidence was collected, label the verdict `Technical evidence only` and keep the human product gate open.
